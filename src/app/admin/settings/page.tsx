export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ResetPanel from "@/components/ResetPanel";

export default function SettingsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p>Campaign administration</p>
        </div>
      </div>

      <ResetPanel />
    </>
  );
}
