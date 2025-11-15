/**
 * Tests for VPS Step Configuration System
 */

import { describe, it, expect } from "vitest";
import {
  getActiveSteps,
  getNextStep,
  getPreviousStep,
  getCurrentStepDisplay,
  isStepActive,
  type StepConfigurationOptions,
} from "./vpsStepConfiguration";

const defaultOptions: StepConfigurationOptions = {
  providerType: "linode",
  formData: {},
};

describe("vpsStepConfiguration", () => {
  describe("getActiveSteps", () => {
    it("should return all 4 steps for Linode provider", () => {
      const steps = getActiveSteps(defaultOptions);

      expect(steps).toHaveLength(4);
      expect(steps.map((s) => s.originalStepNumber)).toEqual([1, 2, 3, 4]);
      expect(steps.map((s) => s.stepNumber)).toEqual([1, 2, 3, 4]);
      expect(steps.every((s) => s.isActive)).toBe(true);
      expect(steps.every((s) => s.totalSteps === 4)).toBe(true);
    });

    it("should customize step 2 title and description for Linode", () => {
      const steps = getActiveSteps(defaultOptions);
      const step2 = steps.find((s) => s.originalStepNumber === 2);

      expect(step2?.title).toBe("1-Click Deployments");
      expect(step2?.description).toContain("StackScript");
    });
  });

  describe("getNextStep", () => {
    it("should return next step in sequence for normal workflow", () => {
      const steps = getActiveSteps(defaultOptions);

      expect(getNextStep(1, steps)).toBe(2);
      expect(getNextStep(2, steps)).toBe(3);
      expect(getNextStep(3, steps)).toBe(4);
      expect(getNextStep(4, steps)).toBeNull();
    });
  });

  describe("getPreviousStep", () => {
    it("should return previous step in sequence for normal workflow", () => {
      const steps = getActiveSteps(defaultOptions);

      expect(getPreviousStep(1, steps)).toBeNull();
      expect(getPreviousStep(2, steps)).toBe(1);
      expect(getPreviousStep(3, steps)).toBe(2);
      expect(getPreviousStep(4, steps)).toBe(3);
    });
  });

  describe("getCurrentStepDisplay", () => {
    it("should return correct display numbers for normal workflow", () => {
      const steps = getActiveSteps(defaultOptions);

      expect(getCurrentStepDisplay(1, steps)).toEqual({
        stepNumber: 1,
        totalSteps: 4,
      });
      expect(getCurrentStepDisplay(4, steps)).toEqual({
        stepNumber: 4,
        totalSteps: 4,
      });
    });

    it("should return null for steps outside the workflow", () => {
      const steps = getActiveSteps(defaultOptions);
      expect(getCurrentStepDisplay(99, steps)).toBeNull();
    });
  });

  describe("isStepActive", () => {
    it("should return true for all steps in the workflow", () => {
      const steps = getActiveSteps(defaultOptions);

      expect(isStepActive(1, steps)).toBe(true);
      expect(isStepActive(2, steps)).toBe(true);
      expect(isStepActive(3, steps)).toBe(true);
      expect(isStepActive(4, steps)).toBe(true);
    });

    it("should return false for steps outside the workflow", () => {
      const steps = getActiveSteps(defaultOptions);
      expect(isStepActive(99, steps)).toBe(false);
    });
  });
});
