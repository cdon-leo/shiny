import branchColors from '@/config/branch-colors.json';

export type BranchName = 'cdon' | 'fyndiq';

export interface BranchColorConfig {
  primary: string;
  primaryLight: string;
}

export function getBranchColors(branch: BranchName): BranchColorConfig {
  const config = branchColors.branches[branch];
  if (!config) {
    // Fallback to cdon colors if branch not found
    return branchColors.branches.cdon;
  }
  return config;
}

export function getSecondaryColor(): string {
  return branchColors.default.secondary;
}

export function getChartColors(branch: BranchName): [string, string] {
  const branchConfig = getBranchColors(branch);
  const secondary = getSecondaryColor();
  return [branchConfig.primary, secondary];
}

