"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { User } from "@/types/User";

interface ActiveChatContextState {
  activeUser: User | null;
  setActiveUser: (user: User) => void;
}

const ActiveChatContext = createContext<ActiveChatContextState | null>(null);

export const ActiveChatProvider = ({ children }: { children: ReactNode }) => {
  const [activeUser, setActiveUser] = useState<User | null>(null);

  return (
    <ActiveChatContext.Provider value={{ activeUser, setActiveUser }}>
      {children}
    </ActiveChatContext.Provider>
  );
};

export const useActiveChat = () => {
  const ctx = useContext(ActiveChatContext);
  if (!ctx) throw new Error("useActiveChat must be inside ActiveChatProvider");
  return ctx;
};