import { create } from "zustand";

type UiState = {
  intakeStep: number;
  showPricingPanel: boolean;
  setIntakeStep: (step: number) => void;
  togglePricingPanel: () => void;
  reset: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  intakeStep: 0,
  showPricingPanel: true,
  setIntakeStep: (intakeStep) => set({ intakeStep }),
  togglePricingPanel: () => set((state) => ({ showPricingPanel: !state.showPricingPanel })),
  reset: () => set({ intakeStep: 0, showPricingPanel: true }),
}));
