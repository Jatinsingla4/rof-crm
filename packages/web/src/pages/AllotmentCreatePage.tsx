import React, { useState, useMemo } from 'react';
import { useConsumers, useUnits, useCreateAllocation, useGenerateDocument } from '../hooks';
import { Button, Card, DataTable, Modal, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

interface AllocationFormState {
  consumerId: string;
  unitId: string;
  projectId: string;
  confirmEligibility: boolean;
  generateLetter: boolean;
}

export function AllotmentCreatePage({ projectId }: { projectId: string }) {
  const [step, setStep] = useState<'select-consumer' | 'select-unit' | 'review' | 'confirm'>('select-consumer');
  const [formState, setFormState] = useState<AllocationFormState>({
    consumerId: '',
    unitId: '',
    projectId,
    confirmEligibility: false,
    generateLetter: true,
  });
  const [selectedConsumer, setSelectedConsumer] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch consumers and units
  const { data: consumersData, isLoading: consumersLoading } = useConsumers({
    projectId,
    leadStage: 'draw_entered',
    pageSize: 100,
  });

  const { data: unitsData, isLoading: unitsLoading } = useUnits({
    projectId,
    status: 'available',
    pageSize: 100,
  });

  const createAllocationMutation = useCreateAllocation();
  const generateDocumentMutation = useGenerateDocument();

  // Consumers list (only draw_entered stage)
  const consumers = useMemo(() => {
    return consumersData?.data || [];
  }, [consumersData]);

  // Units list (only available)
  const units = useMemo(() => {
    return unitsData?.data || [];
  }, [unitsData]);

  // Check eligibility
  const checkEligibility = (consumer: any, unit: any): { eligible: boolean; reason?: string } => {
    if (!consumer || !unit) {
      return { eligible: false, reason: 'Consumer or unit not found' };
    }

    if (consumer.lead_stage !== 'draw_entered') {
      return { eligible: false, reason: 'Consumer is not in draw_entered stage' };
    }

    if (unit.status !== 'available') {
      return { eligible: false, reason: 'Unit is not available' };
    }

    if (consumer.project_id !== unit.project_id) {
      return { eligible: false, reason: 'Consumer and unit must be in same project' };
    }

    return { eligible: true };
  };

  // Step 1: Select Consumer
  const handleSelectConsumer = (consumerId: string) => {
    const consumer = consumers.find((c: any) => c.id === consumerId);
    if (consumer) {
      setSelectedConsumer(consumer);
      setFormState({ ...formState, consumerId });
      setStep('select-unit');
      setError('');
    }
  };

  // Step 2: Select Unit
  const handleSelectUnit = (unitId: string) => {
    const unit = units.find((u: any) => u.id === unitId);
    if (unit) {
      setSelectedUnit(unit);
      setFormState({ ...formState, unitId });

      // Check eligibility
      const eligibility = checkEligibility(selectedConsumer, unit);
      if (!eligibility.eligible) {
        setError(eligibility.reason || 'Eligibility check failed');
        return;
      }

      setStep('review');
      setError('');
    }
  };

  // Step 3: Review & Confirm
  const handleConfirmAllocation = async () => {
    try {
      setError('');

      if (!formState.confirmEligibility) {
        setError('Please confirm eligibility before proceeding');
        return;
      }

      // Create allocation
      const allocationResult = await createAllocationMutation.mutateAsync({
        consumerId: formState.consumerId,
        unitId: formState.unitId,
        projectId: formState.projectId,
      });

      // Generate allotment letter if requested
      if (formState.generateLetter) {
        await generateDocumentMutation.mutateAsync({
          consumerId: formState.consumerId,
          allocationId: allocationResult.id,
          templateId: 'allotment-letter-template', // Pre-existing template
          mergeData: {
            consumerName: selectedConsumer.name,
            unitNumber: selectedUnit.unit_number,
            totalPrice: selectedUnit.total_price_inr,
            bookingAmount: Math.round(selectedUnit.total_price_inr * 0.05),
            allotmentAmount: Math.round(selectedUnit.total_price_inr * 0.20),
          },
          deliveryMethod: 'email',
        });
      }

      setSuccessMessage(
        `Allotment created successfully! Unit ${selectedUnit.unit_number} allocated to ${selectedConsumer.name}.`
      );
      setStep('confirm');

      // Reset form after 3 seconds
      setTimeout(() => {
        setFormState({
          consumerId: '',
          unitId: '',
          projectId,
          confirmEligibility: false,
          generateLetter: true,
        });
        setSelectedConsumer(null);
        setSelectedUnit(null);
        setStep('select-consumer');
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create allocation');
    }
  };

  const handleReset = () => {
    setFormState({
      consumerId: '',
      unitId: '',
      projectId,
      confirmEligibility: false,
      generateLetter: true,
    });
    setSelectedConsumer(null);
    setSelectedUnit(null);
    setStep('select-consumer');
    setError('');
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>One-Click Allotment</h1>

      {successMessage && (
        <div
          style={{
            padding: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: colors.success[50],
            color: colors.success[700],
            borderRadius: 8,
            border: `1px solid ${colors.success[200]}`,
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: spacing.md,
            marginBottom: spacing.lg,
            backgroundColor: colors.error[50],
            color: colors.error[700],
            borderRadius: 8,
            border: `1px solid ${colors.error[200]}`,
          }}
        >
          ✕ {error}
        </div>
      )}

      {/* Step Indicator */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.lg,
          justifyContent: 'space-around',
        }}
      >
        {(['select-consumer', 'select-unit', 'review', 'confirm'] as const).map((s, idx) => (
          <div key={s} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: spacing.xs,
                backgroundColor:
                  step === s || ['select-consumer', 'select-unit', 'review', 'confirm'].indexOf(step) > idx
                    ? colors.primary[600]
                    : colors.neutral[200],
                color: step === s ? 'white' : colors.neutral[700],
                fontWeight: 600,
              }}
            >
              {idx + 1}
            </div>
            <div style={{ fontSize: '12px' }}>
              {s === 'select-consumer' && 'Consumer'}
              {s === 'select-unit' && 'Unit'}
              {s === 'review' && 'Review'}
              {s === 'confirm' && 'Done'}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Select Consumer */}
      {step === 'select-consumer' && (
        <Card>
          <h2>Select Consumer</h2>
          {consumersLoading ? (
            <LoadingSkeleton height={300} />
          ) : consumers.length > 0 ? (
            <div>
              <div style={{ marginBottom: spacing.md, fontSize: '12px', color: colors.neutral[600] }}>
                Showing consumers in 'draw_entered' stage
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: spacing.md,
                }}
              >
                {consumers.map((consumer: any) => (
                  <div
                    key={consumer.id}
                    style={{
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: 8,
                      padding: spacing.md,
                      cursor: 'pointer',
                      backgroundColor:
                        formState.consumerId === consumer.id ? colors.primary[50] : 'white',
                      borderColor:
                        formState.consumerId === consumer.id ? colors.primary[400] : colors.neutral[200],
                      transition: 'all 200ms',
                    }}
                    onClick={() => handleSelectConsumer(consumer.id)}
                  >
                    <div style={{ fontWeight: 600 }}>{consumer.name}</div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.xs }}>
                      {consumer.mobile}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600] }}>
                      Income: {consumer.income_category?.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: spacing.lg, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={handleReset}>
                  Reset
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSelectConsumer(formState.consumerId)}
                  disabled={!formState.consumerId}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
              No consumers in draw_entered stage
            </div>
          )}
        </Card>
      )}

      {/* Step 2: Select Unit */}
      {step === 'select-unit' && (
        <Card>
          <h2>Select Unit for {selectedConsumer?.name}</h2>
          {unitsLoading ? (
            <LoadingSkeleton height={300} />
          ) : units.length > 0 ? (
            <div>
              <div style={{ marginBottom: spacing.md, fontSize: '12px', color: colors.neutral[600] }}>
                Showing available units in project
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: spacing.md,
                }}
              >
                {units.map((unit: any) => (
                  <div
                    key={unit.id}
                    style={{
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: 8,
                      padding: spacing.md,
                      cursor: 'pointer',
                      backgroundColor:
                        formState.unitId === unit.id ? colors.info[50] : 'white',
                      borderColor:
                        formState.unitId === unit.id ? colors.info[400] : colors.neutral[200],
                      transition: 'all 200ms',
                    }}
                    onClick={() => handleSelectUnit(unit.id)}
                  >
                    <div style={{ fontWeight: 600 }}>Unit {unit.unit_number}</div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], marginTop: spacing.xs }}>
                      {unit.tower} • Floor {unit.floor}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.neutral[600] }}>
                      {unit.bhk_type} • {unit.carpet_area_sqm} sq.m
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.primary[600], marginTop: spacing.xs }}>
                      ₹{(unit.total_price_inr / 100000).toFixed(1)}L
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: spacing.lg, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep('select-consumer')}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSelectUnit(formState.unitId)}
                  disabled={!formState.unitId}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
              No available units in this project
            </div>
          )}
        </Card>
      )}

      {/* Step 3: Review & Confirm */}
      {step === 'review' && selectedConsumer && selectedUnit && (
        <Card>
          <h2>Review Allocation</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: spacing.lg,
              marginBottom: spacing.lg,
            }}
          >
            {/* Consumer Details */}
            <div style={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 8, padding: spacing.md }}>
              <h3 style={{ marginTop: 0 }}>Consumer Details</h3>
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Name</div>
                <div style={{ fontWeight: 600 }}>{selectedConsumer.name}</div>
              </div>
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Mobile</div>
                <div>{selectedConsumer.mobile}</div>
              </div>
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Email</div>
                <div>{selectedConsumer.email || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Income Category</div>
                <div style={{ fontWeight: 600 }}>{selectedConsumer.income_category?.toUpperCase()}</div>
              </div>
            </div>

            {/* Unit Details */}
            <div style={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 8, padding: spacing.md }}>
              <h3 style={{ marginTop: 0 }}>Unit Details</h3>
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Unit Number</div>
                <div style={{ fontWeight: 600 }}>{selectedUnit.unit_number}</div>
              </div>
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Location</div>
                <div>
                  {selectedUnit.tower} • Floor {selectedUnit.floor}
                </div>
              </div>
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Configuration</div>
                <div>
                  {selectedUnit.bhk_type} • {selectedUnit.carpet_area_sqm} sq.m
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Total Price</div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: colors.primary[600] }}>
                  ₹{selectedUnit.total_price_inr.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Structure */}
          <Card
            style={{
              backgroundColor: colors.info[50],
              borderLeft: `4px solid ${colors.info[600]}`,
              marginBottom: spacing.lg,
            }}
          >
            <h3 style={{ marginTop: 0, color: colors.info[700] }}>AHP Payment Structure</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md }}>
              <div>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Booking (5%)</div>
                <div style={{ fontWeight: 600 }}>
                  ₹{Math.round(selectedUnit.total_price_inr * 0.05).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>Allotment (20%)</div>
                <div style={{ fontWeight: 600 }}>
                  ₹{Math.round(selectedUnit.total_price_inr * 0.2).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: colors.neutral[600] }}>6× Half-yearly (12.5% each)</div>
                <div style={{ fontWeight: 600 }}>
                  ₹{Math.round(selectedUnit.total_price_inr * 0.125).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </Card>

          {/* Confirmations */}
          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <input
                type="checkbox"
                checked={formState.confirmEligibility}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    confirmEligibility: e.target.checked,
                  })
                }
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>I confirm consumer eligibility and unit availability</span>
            </label>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
              <input
                type="checkbox"
                checked={formState.generateLetter}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    generateLetter: e.target.checked,
                  })
                }
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Generate and send allotment letter via email</span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md }}>
            <Button variant="secondary" onClick={() => setStep('select-unit')}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmAllocation}
              disabled={!formState.confirmEligibility || createAllocationMutation.isPending}
            >
              {createAllocationMutation.isPending ? 'Creating...' : 'Confirm Allotment'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 'confirm' && (
        <Card>
          <div style={{ textAlign: 'center', padding: spacing.lg }}>
            <div style={{ fontSize: '48px', marginBottom: spacing.md }}>✓</div>
            <h2>Allotment Created Successfully!</h2>
            <p style={{ color: colors.neutral[600] }}>
              Unit {selectedUnit?.unit_number} has been allocated to {selectedConsumer?.name}
            </p>
            <Button variant="primary" onClick={handleReset}>
              Create Another Allotment
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
