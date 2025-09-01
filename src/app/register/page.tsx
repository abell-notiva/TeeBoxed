
"use client";

import React, { Suspense, useEffect } from "react";
import { useWizardStore } from "@/hooks/use-wizard-store";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateAccountStep } from "./create-account-step";
import { FacilityDetailsStep } from "./facility-details-step";
import { PlanSelectionStep } from "./plan-selection-step";
import { BaySetupStep } from "./bay-setup-step";
import ReviewStep from "./review-step";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const stepComponents: { [key: number]: React.ComponentType } = {
  1: CreateAccountStep,
  2: FacilityDetailsStep,
  3: PlanSelectionStep,
  4: BaySetupStep,
  5: ReviewStep,
};

const stepTitles: { [key: number]: string } = {
  1: "Create an Account",
  2: "Set Up Your Facility Details",
  3: "Select Your Plan",
  4: "Configure Your Bays",
  5: "Review and Confirm",
};

const stepDescriptions: { [key: number]: string } = {
  1: "This will be the primary account for managing your facility.",
  2: "Tell us about your indoor golf center.",
  3: "Choose the plan that best fits your facility's needs.",
  4: "Define the golf bays available for booking.",
  5: "Please review all the details before launching your new system.",
};

function RegisterPageContent() {
  const { step, setStep, setPlanData, plan, account, setAccountData } = useWizardStore();
  const searchParams = useSearchParams();

  useEffect(() => {
    const planId = searchParams.get("plan");
    const billingFrequency = searchParams.get("freq");

    if (plan.id === "growth" && plan.billingFrequency === "monthly") {
      if (
        (planId === "basic" || planId === "growth" || planId === "pro") &&
        (billingFrequency === "monthly" || billingFrequency === "annually")
      ) {
        setPlanData({ id: planId, billingFrequency });
      }
    }
  }, [searchParams, setPlanData, plan.id, plan.billingFrequency]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && step === 1 && !account.email) {
        // Optional logic if a user is already logged in
      }
    });
    return () => unsubscribe();
  }, [step, setStep, account.email, setAccountData]);

  const CurrentStepComponent = stepComponents[step] || CreateAccountStep;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold tracking-tight">
              {stepTitles[step]}
            </CardTitle>
            <CardDescription className="text-center">
              Step {step} of 5: {stepDescriptions[step]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CurrentStepComponent />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading registration form...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
