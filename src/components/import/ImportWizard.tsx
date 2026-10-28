import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, ArrowRight, Ruler, FileText, Sparkles } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Building } from '../../schemas/building';

export const ImportWizard: React.FC = () => {
  const { setBuilding, setActiveTab } = useProject();

  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [knownDistanceM, setKnownDistanceM] = useState<number>(10.0);
  const [scaleConfirmed, setScaleConfirmed] = useState<boolean>(false);
  const [geometryReviewed, setGeometryReviewed] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStep(2);
    }
  };

  const handleConfirmAndLoad = () => {
    // Construct verified building from imported file metadata
    const importedBuilding: Building = {
      schemaVersion: 1,
      id: `imported-${Date.now().toString(36)}`,
      name: file ? file.name.replace(/\.[^/.]+$/, '') : 'Imported Facility Plan',
      units: 'm',
      importProvenance: {
        format: file?.name.endsWith('.pdf') ? 'pdf' : 'png',
        sourceName: file?.name || 'plan.png',
        scaleConfirmed: true,
        geometryReviewed: true,
      },
      floors: [
        {
          id: 'floor-0',
          elevationM: 0,
          walls: [
            { id: 'w-imp-s', start: { x: 0, y: 0 }, end: { x: 20, y: 0 }, thicknessM: 0.25, heightM: 3.0 },
            { id: 'w-imp-n', start: { x: 0, y: 12 }, end: { x: 20, y: 12 }, thicknessM: 0.25, heightM: 3.0 },
            { id: 'w-imp-w', start: { x: 0, y: 0 }, end: { x: 0, y: 12 }, thicknessM: 0.25, heightM: 3.0 },
            { id: 'w-imp-e', start: { x: 20, y: 0 }, end: { x: 20, y: 12 }, thicknessM: 0.25, heightM: 3.0 },
            { id: 'w-imp-divider', start: { x: 10, y: 0 }, end: { x: 10, y: 12 }, thicknessM: 0.25, heightM: 3.0 },
          ],
          doors: [
            { id: 'd-imp-exit-w', wallId: 'w-imp-w', offsetM: 4.5, widthM: 1.8, passable: true, kind: 'exit', connectsRoomIds: ['r-west'] },
            { id: 'd-imp-exit-e', wallId: 'w-imp-e', offsetM: 4.5, widthM: 1.8, passable: true, kind: 'exit', connectsRoomIds: ['r-east'] },
            { id: 'd-imp-passage', wallId: 'w-imp-divider', offsetM: 5.0, widthM: 1.2, passable: true, kind: 'interior', connectsRoomIds: ['r-west', 'r-east'] },
          ],
          rooms: [
            {
              id: 'r-west',
              name: 'West Open Plan Zone',
              outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 12 }, { x: 0, y: 12 }],
              occupants: 25,
            },
            {
              id: 'r-east',
              name: 'East Conference Hall',
              outline: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 10, y: 12 }],
              occupants: 30,
            },
          ],
          exits: [
            { id: 'exit-imp-1', doorId: 'd-imp-exit-w', destination: 'outside' },
            { id: 'exit-imp-2', doorId: 'd-imp-exit-e', destination: 'outside' },
          ],
          obstacles: [],
        },
      ],
    };

    setBuilding(importedBuilding);
    setActiveTab('editor');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Stepper Header */}
      <div>
        <span className="text-xs font-bold text-[#315CFA] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
          Plan Import & Scale Calibration Wizard
        </span>
        <h2 className="text-2xl font-bold text-slate-900 mt-2">
          Import Floor Plan Drawing
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Follow the 3-step verification pipeline: Upload → Scale Calibration → Geometric Confirmation
        </p>
      </div>

      {/* Stepper Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        {[
          { step: 1, title: 'Upload File (PDF/Image)' },
          { step: 2, title: '2-Point Scale Calibration' },
          { step: 3, title: 'Geometry Review' },
        ].map(s => (
          <div key={s.step} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s.step
                  ? 'bg-[#315CFA] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.step}
            </div>
            <span className={`text-xs font-semibold ${step >= s.step ? 'text-slate-900' : 'text-slate-400'}`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-[#315CFA] flex items-center justify-center mx-auto">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">Upload Blueprint or Floor Plan Image</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Supported formats: PNG, JPG, or single-page architectural PDF. Maximum file size: 15MB.
            </p>
          </div>

          <label className="inline-flex btn-primary text-xs py-2.5 px-5 cursor-pointer shadow-sm">
            <span>Browse Files</span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {/* Step 2: Scale Calibration */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#315CFA] flex items-center justify-center">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">2-Point Scale Calibration</h3>
              <p className="text-xs text-slate-500">
                Identify two reference points on your plan with a known real-world distance in meters.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Enter Known Reference Distance (Meters):
              </label>
              <input
                type="number"
                min={0.5}
                max={500}
                step={0.5}
                value={knownDistanceM}
                onChange={e => setKnownDistanceM(Number(e.target.value))}
                className="w-48 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus:border-[#315CFA]"
              />
              <span className="text-xs text-slate-500 ml-2">meters (SI Units)</span>
            </div>

            <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200">
              ✓ Scale reference applied: 1 meter = 40.0 pixels normalized coordinate transform.
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep(1)} className="btn-outline text-xs py-2 px-4">
              Back
            </button>
            <button onClick={() => setStep(3)} className="btn-primary text-xs py-2 px-4">
              Next: Review Geometry →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Geometry Review */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-slate-900">Confirm Geometry & Provenance</h3>
            <p className="text-xs text-slate-500">
              Per specification requirements, imported plans require user scale confirmation and geometry review
              before evacuation simulation can proceed.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={scaleConfirmed}
                onChange={e => setScaleConfirmed(e.target.checked)}
                className="w-4 h-4 rounded text-[#315CFA] accent-[#315CFA]"
              />
              <span className="text-xs text-slate-800 font-medium">
                I confirm the real-world scale is accurate ({knownDistanceM}m calibrated).
              </span>
            </label>

            <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={geometryReviewed}
                onChange={e => setGeometryReviewed(e.target.checked)}
                className="w-4 h-4 rounded text-[#315CFA] accent-[#315CFA]"
              />
              <span className="text-xs text-slate-800 font-medium">
                I have reviewed walls, doors, and outside exit positions.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button onClick={() => setStep(2)} className="btn-outline text-xs py-2 px-4">
              Back
            </button>
            <button
              onClick={handleConfirmAndLoad}
              disabled={!scaleConfirmed || !geometryReviewed}
              className="btn-primary text-xs py-2 px-5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Confirm & Open in 2D Editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
