"use client";

export default function HowToDownloadContent() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
        How To Download
      </h1>
      <p className="mt-2 text-sm text-[color:var(--subtle)]">
        Add Beliefted to your home screen for fast access.
      </p>

      <div className="mt-8 space-y-6 text-sm text-[color:var(--ink)]">
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Add to Home Screen</h2>
          <p className="font-semibold">Safari (iOS)</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Beliefted in Safari.</li>
            <li>Tap the Share icon.</li>
            <li>Choose “Add to Home Screen”.</li>
            <li>Confirm the name and tap Add.</li>
          </ol>
          <p className="font-semibold mt-4">Android (Chrome)</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Beliefted in Chrome.</li>
            <li>Tap the menu (three dots).</li>
            <li>Select “Add to Home screen” or “Install app”.</li>
            <li>Confirm to add it to your device.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
