"use client";

import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { User } from "@/types/User";

interface EditProfileModalState {
  isOpen: boolean;
  user: User | null;
  openEditProfile: (user: User) => void;
  closeEditProfile: () => void;
}

const EditProfileModalContext = createContext<EditProfileModalState | null>(null);

export const EditProfileModalProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
    setUser(null);
  }, [pathname]);

  const openEditProfile = (nextUser: User) => {
    setUser(nextUser);
    setIsOpen(true);
  };

  const closeEditProfile = () => {
    setIsOpen(false);
  };

  return (
    <EditProfileModalContext.Provider
      value={{ isOpen, user, openEditProfile, closeEditProfile }}
    >
      {children}
    </EditProfileModalContext.Provider>
  );
};

export const useEditProfileModal = () => {
  const ctx = useContext(EditProfileModalContext);
  if (!ctx) throw new Error("useEditProfileModal must be inside EditProfileModalProvider");
  return ctx;
};
