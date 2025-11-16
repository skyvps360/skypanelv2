/**
 * VPS Step Configuration System
 * Provides conditional step logic for VPS creation workflow based on provider type and user selections
 */

import type { ProviderType } from "@/types/provider";
import type { CreateVPSForm } from "@/types/vps";

/**
 * Configuration for a single step in the VPS creation workflow
 */
export interface StepConfiguration {
  /** Original step number (1-4) used for internal routing */
  originalStepNumber: number;
  /** Display step number (renumbered sequentially based on active steps) */
  stepNumber: number;
  /** Whether this step is active in the current workflow */
  isActive: boolean;
  /** Step identifier for routing */
  id: string;
  /** Display title for the step */
  title: string;
  /** Description text for the step */
  description: string;
  /** Total number of active steps in the workflow */
  totalSteps: number;
}

/**
 * Options for determining step configuration
 */
export interface StepConfigurationOptions {
  /** The selected provider type */
  providerType: ProviderType;
  /** Current form data for additional context */
  formData: Partial<CreateVPSForm>;
}

/**
 * All possible steps in the VPS creation workflow
 */
const ALL_STEPS = [
  {
    originalStepNumber: 1,
    id: "plan",
    title: "Plan & Label",
    description: "Configure the server label and pricing plan before provisioning.",
  },
  {
    originalStepNumber: 2,
    id: "deployments",
    title: "1-Click Deployments",
    description: "Optionally provision with a StackScript or continue without one.",
  },
  {
    originalStepNumber: 3,
    id: "os",
    title: "Operating System",
    description: "Pick the base operating system for this VPS.",
  },
  {
    originalStepNumber: 4,
    id: "finalize",
    title: "Finalize & Review",
    description: "Set credentials and optional add-ons before provisioning.",
  },
] as const;

/**
 * Determines which steps should be active based on provider type and user selections
 * 
 * Rules:
 * - Linode: Always show all steps
 * - Steps are renumbered sequentially for display (e.g., 1, 2, 4 becomes 1, 2, 3)
 * 
 * @param options - Configuration options including provider type and marketplace app selection
 * @returns Array of step configurations with active status and renumbered display numbers
 */
export function getActiveSteps(
  options: StepConfigurationOptions
): StepConfiguration[] {
  const { providerType } = options;

  const activeSteps = ALL_STEPS;

  // Calculate total active steps for display
  const totalSteps = activeSteps.length;

  // Renumber steps sequentially for display while preserving original numbers for routing
  return activeSteps.map((step, index) => ({
    originalStepNumber: step.originalStepNumber,
    stepNumber: index + 1, // Display number (1, 2, 3)
    isActive: true,
    id: step.id,
    title: getDynamicStepTitle(step, providerType),
    description: getDynamicStepDescription(step, providerType),
    totalSteps,
  }));
}

/**
 * Gets the dynamic title for a step based on provider type
 * 
 * @param step - The step configuration
 * @param providerType - The selected provider type
 * @returns The appropriate title for the step
 */
function getDynamicStepTitle(
  step: typeof ALL_STEPS[number],
  providerType: ProviderType
): string {
  return step.title;
}

/**
 * Gets the dynamic description for a step based on provider type and selections
 * 
 * @param step - The step configuration
 * @param providerType - The selected provider type
 * @param hasMarketplaceApp - Whether a marketplace app is selected
 * @returns The appropriate description for the step
 */
function getDynamicStepDescription(
  step: typeof ALL_STEPS[number],
  providerType: ProviderType
): string {
  return step.description;
}

/**
 * Gets the next active step number from the current step
 * 
 * @param currentStep - The current original step number
 * @param activeSteps - Array of active step configurations
 * @returns The next active step's original number, or null if at the end
 */
export function getNextStep(
  currentStep: number,
  activeSteps: StepConfiguration[]
): number | null {
  const activeStepNumbers = activeSteps.map((s) => s.originalStepNumber);
  const currentIndex = activeStepNumbers.indexOf(currentStep);

  if (currentIndex === -1 || currentIndex >= activeStepNumbers.length - 1) {
    return null;
  }

  return activeStepNumbers[currentIndex + 1];
}

/**
 * Gets the previous active step number from the current step
 * 
 * @param currentStep - The current original step number
 * @param activeSteps - Array of active step configurations
 * @returns The previous active step's original number, or null if at the beginning
 */
export function getPreviousStep(
  currentStep: number,
  activeSteps: StepConfiguration[]
): number | null {
  const activeStepNumbers = activeSteps.map((s) => s.originalStepNumber);
  const currentIndex = activeStepNumbers.indexOf(currentStep);

  if (currentIndex <= 0) {
    return null;
  }

  return activeStepNumbers[currentIndex - 1];
}

/**
 * Gets the display information for the current step
 * 
 * @param currentStep - The current original step number
 * @param activeSteps - Array of active step configurations
 * @returns Object with current display number and total steps, or null if step not found
 */
export function getCurrentStepDisplay(
  currentStep: number,
  activeSteps: StepConfiguration[]
): { stepNumber: number; totalSteps: number } | null {
  const step = activeSteps.find((s) => s.originalStepNumber === currentStep);
  
  if (!step) {
    return null;
  }

  return {
    stepNumber: step.stepNumber,
    totalSteps: step.totalSteps,
  };
}

/**
 * Checks if a step is active in the current workflow
 * 
 * @param stepNumber - The original step number to check
 * @param activeSteps - Array of active step configurations
 * @returns True if the step is active, false otherwise
 */
export function isStepActive(
  stepNumber: number,
  activeSteps: StepConfiguration[]
): boolean {
  return activeSteps.some((s) => s.originalStepNumber === stepNumber);
}
