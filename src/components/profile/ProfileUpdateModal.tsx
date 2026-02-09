"use client";

import { useState } from "react";
import Modal from "@/components/layout/Modal";
import ProfileSettings from "@/components/profile/ProfileSettings";
import Button from "@/components/ui/Button";

type ProfileUpdateModalProps = {
  currentUsername?: string | null;
  currentName?: string | null;
  currentBio?: string | null;
  currentImage?: string | null;
  onUpdated?: () => void;
};

export default function ProfileUpdateModal({
  currentUsername,
  currentName,
  currentBio,
  currentImage,
  onUpdated,
}: ProfileUpdateModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
      >
        Update profile
      </Button>
      <Modal title="Update profile" isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ProfileSettings
          currentUsername={currentUsername}
          currentName={currentName}
          currentBio={currentBio}
          currentImage={currentImage}
          showPhoto={false}
          onUpdated={() => {
            setIsOpen(false);
            onUpdated?.();
          }}
        />
      </Modal>
    </div>
  );
}
