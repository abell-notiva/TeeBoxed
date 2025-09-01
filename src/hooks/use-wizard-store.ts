
import { create } from 'zustand';

type Bay = {
  name: string;
};

type WizardState = {
  step: number;
  account: {
    fullName: string;
    email: string;
    password: string;
  };
  facility: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    timeZone: string;
    slug: string;
  };
  plan: {
    id: 'basic' | 'growth' | 'pro' | 'enterprise';
    billingFrequency: 'monthly' | 'annually';
  };
  bays: Bay[];
  
  setStep: (step: number) => void;
  setAccountData: (data: Partial<WizardState['account']>) => void;
  setFacilityData: (data: Partial<WizardState['facility']>) => void;
  setPlanData: (data: Partial<WizardState['plan']>) => void;
  setBays: (bays: Bay[]) => void;
  addBay: () => void;
  updateBayName: (index: number, name: string) => void;
  removeBay: (index: number) => void;
  reset: () => void;
};

const initialState: Omit<WizardState, 'setStep' | 'setAccountData' | 'setFacilityData' | 'setPlanData' | 'setBays' | 'addBay' | 'updateBayName' | 'removeBay' | 'reset'> = {
    step: 1,
    account: {
      fullName: '',
      email: '',
      password: '',
    },
    facility: {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA',
      timeZone: '',
      slug: '',
    },
    plan: {
      id: 'growth' as const,
      billingFrequency: 'monthly' as const,
    },
    bays: [{ name: 'Bay 1' }],
};

export const useWizardStore = create<WizardState>((set, get) => ({
  ...initialState,
  
  setStep: (step) => set({ step }),
  
  setAccountData: (data) => set((state) => ({ account: { ...state.account, ...data } })),
  
  setFacilityData: (data) => set((state) => ({ facility: { ...state.facility, ...data } })),
  
  setPlanData: (data) => set((state) => ({ plan: { ...state.plan, ...data } })),
  
  setBays: (bays) => set({ bays }),

  addBay: () => set((state) => {
    if (state.bays.length < 20) {
        return { bays: [...state.bays, { name: `Bay ${state.bays.length + 1}` }] };
    }
    return {};
  }),

  updateBayName: (index, name) => set(state => {
    const newBays = [...state.bays];
    if (newBays[index]) {
      newBays[index] = { ...newBays[index], name };
    }
    return { bays: newBays };
  }),

  removeBay: (index) => set(state => ({
    bays: state.bays.filter((_, i) => i !== index),
  })),
  
  reset: () => set(initialState),
}));
