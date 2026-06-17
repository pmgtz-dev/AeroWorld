"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { User } from "@/types/User";

interface ProfileModalState {
  isOpen: boolean;
  user: User | null;
  openProfile: (user: User) => void;
  closeProfile: () => void;
}

const ProfileModalContext = createContext<ProfileModalState | null>(null);

export const ProfileModalProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
    setUser(null);
  }, [pathname]);

  const openProfile = (u: User) => {
    setUser(u);
    setIsOpen(true);
  };

  const closeProfile = () => {
    setIsOpen(false);
  };

  return (
    <ProfileModalContext.Provider value={{ isOpen, user, openProfile, closeProfile }}>
      {children}
    </ProfileModalContext.Provider>
  );
};

export const useProfileModal = () => {
  const ctx = useContext(ProfileModalContext);
  if (!ctx) throw new Error("useProfileModal must be inside ProfileModalProvider");
  return ctx;
};
