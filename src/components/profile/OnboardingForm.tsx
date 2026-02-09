"use client";

import { useState } from "react";
import Link from "next/link";
import ProfileSettings from "@/components/profile/ProfileSettings";

type OnboardingFormProps = {
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  image?: string | null;
};

export default function OnboardingForm({
  name,
  username,
  bio,
  image,
}: OnboardingFormProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[color:var(--panel-border)] p-4 text-sm text-[color:var(--subtle)]">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              className="text-[color:var(--ink)] underline underline-offset-2"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[color:var(--ink)] underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            . We store your name, email, username, and profile details to create
            your account.
          </span>
        </label>
      </div>

      <ProfileSettings
        required
        currentName={name ?? null}
        currentUsername={username ?? null}
        currentBio={bio ?? null}
        currentImage={image ?? null}
        showPhoto
        showDangerZone={false}
        submitDisabled={!agreed}
        submitDisabledMessage="Agree to the Terms and Privacy Policy to continue."
      />
    </div>
  );
}
