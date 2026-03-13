import { BN } from "@coral-xyz/anchor";

const SWITCHBOARD_PRECISION = 18;

/**
 * Calculate the collateral required to mint stablecoins at the oracle price.
 *
 * @param stablecoinAmount - Amount of stablecoins to mint (in base units)
 * @param oraclePrice - Oracle price as i128 with 18 decimal places
 * @param stablecoinDecimals - Decimals of the stablecoin
 * @param collateralDecimals - Decimals of the collateral token
 * @param spreadBps - Spread in basis points
 * @returns Collateral required in base units
 */
export function calculateCollateralForMint(
  stablecoinAmount: BN,
  oraclePrice: BN,
  stablecoinDecimals: number,
  collateralDecimals: number,
  spreadBps: number
): BN {
  const switchboardFactor = new BN(10).pow(new BN(SWITCHBOARD_PRECISION));
  let numerator = stablecoinAmount.mul(oraclePrice);

  let collateralRaw: BN;
  if (collateralDecimals >= stablecoinDecimals) {
    const extra = new BN(10).pow(
      new BN(collateralDecimals - stablecoinDecimals)
    );
    collateralRaw = numerator.mul(extra).div(switchboardFactor);
  } else {
    const extra = new BN(10).pow(
      new BN(stablecoinDecimals - collateralDecimals)
    );
    collateralRaw = numerator.div(switchboardFactor).div(extra);
  }

  // Apply spread: collateral * (10000 + spread_bps) / 10000
  const withSpread = collateralRaw
    .mul(new BN(10000 + spreadBps))
    .div(new BN(10000));

  // Round up
  return withSpread.add(new BN(1));
}

/**
 * Calculate the collateral returned when redeeming stablecoins at the oracle price.
 */
export function calculateCollateralForRedeem(
  stablecoinAmount: BN,
  oraclePrice: BN,
  stablecoinDecimals: number,
  collateralDecimals: number,
  spreadBps: number
): BN {
  const switchboardFactor = new BN(10).pow(new BN(SWITCHBOARD_PRECISION));
  let numerator = stablecoinAmount.mul(oraclePrice);

  let collateralRaw: BN;
  if (collateralDecimals >= stablecoinDecimals) {
    const extra = new BN(10).pow(
      new BN(collateralDecimals - stablecoinDecimals)
    );
    collateralRaw = numerator.mul(extra).div(switchboardFactor);
  } else {
    const extra = new BN(10).pow(
      new BN(stablecoinDecimals - collateralDecimals)
    );
    collateralRaw = numerator.div(switchboardFactor).div(extra);
  }

  // Apply spread: collateral * (10000 - spread_bps) / 10000
  return collateralRaw.mul(new BN(10000 - spreadBps)).div(new BN(10000));
}
