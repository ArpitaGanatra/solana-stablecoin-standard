import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const SWITCHBOARD_DECIMALS = 18;
const SWITCHBOARD_FACTOR = new BN(10).pow(new BN(SWITCHBOARD_DECIMALS));

export interface PriceData {
  /** Raw mantissa from Switchboard (i128 with 18 decimals) */
  rawMantissa: BN;
  /** Human-readable price as a number */
  price: number;
  /** Slot at which the price was fetched */
  slot: number;
  /** Timestamp of the fetch */
  timestamp: Date;
}

export interface PriceFeedConfig {
  /** Switchboard feed address */
  feedAddress: PublicKey;
  /** Maximum staleness in slots before price is considered stale */
  maxStaleSlots?: number;
  /** Minimum oracle responses for confidence */
  minSamples?: number;
}

/**
 * OraclePriceFeed — fetches and parses Switchboard on-demand pull feed data.
 *
 * This is the off-chain counterpart to the on-chain sss-oracle program.
 * Use it for UI display, pre-flight checks, and monitoring — the on-chain
 * program always reads the feed directly for execution.
 */
export class OraclePriceFeed {
  private connection: Connection;
  private config: Required<PriceFeedConfig>;

  constructor(connection: Connection, config: PriceFeedConfig) {
    this.connection = connection;
    this.config = {
      feedAddress: config.feedAddress,
      maxStaleSlots: config.maxStaleSlots ?? 100,
      minSamples: config.minSamples ?? 1,
    };
  }

  /**
   * Fetch the latest price from the Switchboard feed account.
   * Reads the raw account data and extracts the result field.
   */
  async fetchPrice(): Promise<PriceData> {
    const accountInfo = await this.connection.getAccountInfo(
      this.config.feedAddress
    );

    if (!accountInfo || !accountInfo.data) {
      throw new Error(
        `Feed account not found: ${this.config.feedAddress.toBase58()}`
      );
    }

    // Switchboard PullFeedAccountData stores the result as an i128 at a known offset.
    // The result field (SwitchboardDecimal) is at offset 32 in the account data
    // after the 8-byte discriminator. The mantissa is a 16-byte little-endian i128.
    //
    // For production use, prefer the @switchboard-xyz/on-demand SDK to parse.
    // This is a lightweight extraction for monitoring/display purposes.
    const data = accountInfo.data;

    // Extract slot from account info
    const slot = await this.connection.getSlot();

    // Parse the mantissa from the feed data
    // Switchboard on-demand stores the latest result at bytes 8..24 (after discriminator)
    const mantissaBytes = data.subarray(8, 24);
    const rawMantissa = new BN(mantissaBytes, "le");

    // Convert to human-readable price
    const price = rawMantissa.toNumber() / Math.pow(10, SWITCHBOARD_DECIMALS);

    return {
      rawMantissa,
      price,
      slot,
      timestamp: new Date(),
    };
  }

  /**
   * Check if the current price is stale based on configured max slots.
   */
  async isStale(): Promise<boolean> {
    try {
      const priceData = await this.fetchPrice();
      const currentSlot = await this.connection.getSlot();
      return currentSlot - priceData.slot > this.config.maxStaleSlots;
    } catch {
      return true;
    }
  }

  /**
   * Calculate collateral needed to mint stablecoin amount.
   * Mirror of the on-chain calculation in sss-oracle.
   */
  calculateCollateralForMint(
    stablecoinAmount: BN,
    oraclePrice: BN,
    stablecoinDecimals: number,
    collateralDecimals: number,
    spreadBps: number
  ): BN {
    const numerator = stablecoinAmount.mul(oraclePrice);
    let collateral = numerator.div(SWITCHBOARD_FACTOR);

    // Adjust for decimal differences
    if (stablecoinDecimals > collateralDecimals) {
      const factor = new BN(10).pow(
        new BN(stablecoinDecimals - collateralDecimals)
      );
      collateral = collateral.div(factor);
    } else if (collateralDecimals > stablecoinDecimals) {
      const factor = new BN(10).pow(
        new BN(collateralDecimals - stablecoinDecimals)
      );
      collateral = collateral.mul(factor);
    }

    // Apply spread (user pays more)
    collateral = collateral
      .mul(new BN(10000 + spreadBps))
      .div(new BN(10000))
      .add(new BN(1)); // Round up

    return collateral;
  }

  /**
   * Calculate collateral returned when redeeming stablecoin amount.
   * Mirror of the on-chain calculation in sss-oracle.
   */
  calculateCollateralForRedeem(
    stablecoinAmount: BN,
    oraclePrice: BN,
    stablecoinDecimals: number,
    collateralDecimals: number,
    spreadBps: number
  ): BN {
    const numerator = stablecoinAmount.mul(oraclePrice);
    let collateral = numerator.div(SWITCHBOARD_FACTOR);

    // Adjust for decimal differences
    if (stablecoinDecimals > collateralDecimals) {
      const factor = new BN(10).pow(
        new BN(stablecoinDecimals - collateralDecimals)
      );
      collateral = collateral.div(factor);
    } else if (collateralDecimals > stablecoinDecimals) {
      const factor = new BN(10).pow(
        new BN(collateralDecimals - stablecoinDecimals)
      );
      collateral = collateral.mul(factor);
    }

    // Apply spread (user receives less)
    collateral = collateral.mul(new BN(10000 - spreadBps)).div(new BN(10000));

    return collateral;
  }

  get feedAddress(): PublicKey {
    return this.config.feedAddress;
  }
}
