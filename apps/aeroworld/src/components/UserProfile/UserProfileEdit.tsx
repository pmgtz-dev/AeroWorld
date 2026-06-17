"use client";

import styles from "./UserProfile.module.scss";
import { ChangeEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditProfileModal } from "@/app/_providers/EditProfileModalContext";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import UserProfile from "./UserProfile";
import { User } from "@/types/User";
import { createPortal } from "react-dom";
import { getNextWindowZIndex } from "@/lib/windowZIndex";

const DEFAULT_AVATARS = [
  "/images/defaultpfp_grey.jpg",
  "/images/defaultpfp_blue.jpg",
  "/images/defaultpfp_green.jpg",
  "/images/defaultpfp_pink.jpg",
  "/images/defaultpfp_purple.jpg",
  "/images/defaultpfp_1.jpg",
  "/images/defaultpfp_2.jpg",
  "/images/defaultpfp_3.jpg",
  "/images/defaultpfp_4.jpg",
];
const isDefaultAvatarUrl = (avatarUrl: string | null | undefined) =>
  !!avatarUrl && DEFAULT_AVATARS.includes(avatarUrl);
const CALENDAR_WEEK_DAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const getCalendarInputParts = (date: Date) => ({
  day: format(date, "dd"),
  month: format(date, "MM"),
  year: format(date, "yyyy"),
});
const parseCalendarInputParts = (dayValue: string, monthValue: string, yearValue: string) => {
  if (dayValue.length !== 2 || monthValue.length !== 2 || yearValue.length !== 4) return null;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }
  return parsedDate;
};

type EditProfileSettingsMenu = {
  x: number;
  y: number;
  isPositioned: boolean;
} | null;

export default function UserProfileEdit() {
  const { isOpen, user, closeEditProfile } = useEditProfileModal();
  const [size, setSize] = useState({ width: 30, height: 80 });
  const [position, setPosition] = useState({ x: 100, y: 120 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(getNextWindowZIndex());
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [selectedAvatarIndex, setSelectedAvatarIndex] = useState(0);
  const [avatarAnimationDirection, setAvatarAnimationDirection] = useState<"" | "left" | "right">("");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [likeStuff, setLikeStuff] = useState("");
  const [dislikeStuff, setDislikeStuff] = useState("");
  const [chooseFromGallery, setChooseFromGallery] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [backgroundImagePreviewUrl, setBackgroundImagePreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const [calendarNow, setCalendarNow] = useState(new Date());
  const [calendarMonthDate, setCalendarMonthDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [calendarDayInput, setCalendarDayInput] = useState(format(new Date(), "dd"));
  const [calendarMonthInput, setCalendarMonthInput] = useState(format(new Date(), "MM"));
  const [calendarYearInput, setCalendarYearInput] = useState(format(new Date(), "yyyy"));
  const [saveDateOfBirth, setSaveDateOfBirth] = useState(true);
  const [shouldPersistDateOfBirth, setShouldPersistDateOfBirth] = useState(false);
  const [hideBirthYear, setHideBirthYear] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 140, y: 140 });
  const [previewZIndex, setPreviewZIndex] = useState(getNextWindowZIndex());
  const [settingsMenu, setSettingsMenu] = useState<EditProfileSettingsMenu>(null);
  const [closeConfirmDialogOpen, setCloseConfirmDialogOpen] = useState(false);
  const profileWindowScrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const bioRef = useRef<HTMLTextAreaElement | null>(null);
  const likeStuffRef = useRef<HTMLTextAreaElement | null>(null);
  const dislikeStuffRef = useRef<HTMLTextAreaElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);

  const playNavigationSound = () => {
    const navigationStart = navigationStartRef.current;
    if (!navigationStart) return;
    navigationStart.currentTime = 0;
    void navigationStart.play().catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    const parsedDateOfBirth = user.dateOfBirth ? parseISO(user.dateOfBirth) : null;
    const validDateOfBirth =
      parsedDateOfBirth && !Number.isNaN(parsedDateOfBirth.getTime())
        ? parsedDateOfBirth
        : new Date();
    const avatarIndex = DEFAULT_AVATARS.findIndex(
      (avatar) => avatar === user.avatarUrl
    );
    const greyAvatarIndex = DEFAULT_AVATARS.findIndex(
      (avatar) => avatar === "/images/defaultpfp_grey.jpg"
    );
    setSelectedAvatarIndex(
      avatarIndex >= 0
        ? avatarIndex
        : greyAvatarIndex >= 0
        ? greyAvatarIndex
        : 0
    );
    setNickname(user.nickname ?? "");
    setUsername(user.username ?? "");
    setBio(user.bio ?? "");
    setLikeStuff(user.likeStuff ?? "");
    setDislikeStuff(user.dislikeStuff ?? "");
    setChooseFromGallery(!!user.avatarUrl && !isDefaultAvatarUrl(user.avatarUrl));
    setAvatarPreviewUrl(
      user.avatarUrl && !isDefaultAvatarUrl(user.avatarUrl)
        ? user.avatarUrl
        : null
    );
    setBackgroundImagePreviewUrl(user.backgroundImageUrl ?? null);
    setAvatarFile(null);
    setBackgroundImageFile(null);
    setCalendarMonthDate(validDateOfBirth);
    setSelectedCalendarDate(validDateOfBirth);
    setShouldPersistDateOfBirth(false);
    setHideBirthYear(Boolean(user.dateOfBirth) && user.showYearOfBirth === false);
    const nextParts = getCalendarInputParts(validDateOfBirth);
    setCalendarDayInput(nextParts.day);
    setCalendarMonthInput(nextParts.month);
    setCalendarYearInput(nextParts.year);
    setIsPreviewOpen(false);
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setZIndex(getNextWindowZIndex());
    setIsMinimizing(false);
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!settingsMenu) return;

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.menu-item')) return;
      setSettingsMenu(null);
    };

    document.addEventListener("mousedown", closeMenu);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
    };
  }, [settingsMenu]);

  useEffect(() => {
    if (!settingsMenu || !settingsMenuRef.current || !frameRef.current) return;

    const menu = settingsMenuRef.current;
    const wrapperRect = frameRef.current.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 6;

    let nextX = settingsMenu.x;
    let nextY = settingsMenu.y;
    let placeToLeft = false;

    if (nextX + menuRect.width > wrapperRect.width - gap) {
      nextX = Math.max(gap, settingsMenu.x - menuRect.width);
      placeToLeft = true;
    }

    if (nextY + menuRect.height > wrapperRect.height - gap) {
      nextY = Math.max(gap, settingsMenu.y - menuRect.height);
    }

    if (placeToLeft) {
      nextX = Math.max(gap, nextX - 11);
    }

    if (nextX < gap) nextX = gap;
    if (nextY < gap) nextY = gap;

    if (
      nextX !== settingsMenu.x ||
      nextY !== settingsMenu.y ||
      !settingsMenu.isPositioned
    ) {
      setSettingsMenu((current) =>
        current
          ? { ...current, x: nextX, y: nextY, isPositioned: true }
          : current
      );
    }
  }, [settingsMenu]);

  useEffect(() => {
    if (!avatarAnimationDirection) return;
    const timeout = window.setTimeout(() => setAvatarAnimationDirection(""), 180);
    return () => window.clearTimeout(timeout);
  }, [avatarAnimationDirection]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    return () => {
      if (backgroundImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(backgroundImagePreviewUrl);
      }
    };
  }, [backgroundImagePreviewUrl]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCalendarNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const resizeTextarea = (node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  };

  const syncAboutInputsLayout = (scrollToBottom = false) => {
    resizeTextarea(bioRef.current);
    resizeTextarea(likeStuffRef.current);
    resizeTextarea(dislikeStuffRef.current);
    if (scrollToBottom && profileWindowScrollRef.current) {
      profileWindowScrollRef.current.scrollTop = profileWindowScrollRef.current.scrollHeight;
    }
  };

  const normalizeTextareaValue = (
    value: string,
    selectionStart: number | null,
  ) => {
    let normalized = "";
    let nextSelection = selectionStart ?? value.length;
    let consecutiveNewlines = 0;

    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];

      if (char === "\r") {
        if (index < nextSelection) nextSelection -= 1;
        continue;
      }

      if (char === "\n") {
        consecutiveNewlines += 1;
        if (consecutiveNewlines > 2) {
          if (index < nextSelection) nextSelection -= 1;
          continue;
        }
      } else {
        consecutiveNewlines = 0;
      }

      normalized += char;
    }

    return { normalized, nextSelection };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    setSettingsMenu(null);
    setZIndex(getNextWindowZIndex());
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseUp = () => {
    document.body.style.userSelect = "";
    setDragging(false);
  };

  const handleMinimize = () => {
    if (!frameRef.current) {
      closeEditProfile();
      return;
    }
    document.body.style.userSelect = "";
    setDragging(false);
    setIsMinimizing(true);
    window.setTimeout(() => {
      setIsMinimizing(false);
      closeEditProfile();
    }, 280);
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  useLayoutEffect(() => {
    syncAboutInputsLayout(false);
  }, [bio, likeStuff, size.width, size.height, isOpen]);

  useLayoutEffect(() => {
    syncAboutInputsLayout(true);
  }, [dislikeStuff]);

  useEffect(() => {
    const handleWindowResize = () => {
      requestAnimationFrame(() => {
        syncAboutInputsLayout(false);
      });
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  if (!isOpen || !user) return null;

  const aboutPlaceholder = "Не указано";
  const today = new Date(calendarNow.getFullYear(), calendarNow.getMonth(), calendarNow.getDate());
  const minDate = new Date(today);
  minDate.setFullYear(today.getFullYear() - 100);
  const isBirthDateInputComplete = calendarDayInput.length === 2 && calendarMonthInput.length === 2 && calendarYearInput.length === 4;
  const parsedBirthDate = parseCalendarInputParts(calendarDayInput, calendarMonthInput, calendarYearInput);
  const isBirthDateValid = isBirthDateInputComplete && !!parsedBirthDate && parsedBirthDate.getTime() >= minDate.getTime() && parsedBirthDate.getTime() <= today.getTime();
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonthDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(calendarMonthDate), { weekStartsOn: 1 }),
  });
  const getAvatarAt = (offset: number) =>
    DEFAULT_AVATARS[
      (selectedAvatarIndex + offset + DEFAULT_AVATARS.length) %
        DEFAULT_AVATARS.length
    ];

  const moveAvatarSelection = (direction: -1 | 1) => {
    setAvatarAnimationDirection(direction === -1 ? "left" : "right");
    setSelectedAvatarIndex((current) =>
      (current + direction + DEFAULT_AVATARS.length) % DEFAULT_AVATARS.length
    );
  };

  const resetProfileEditValues = () => {
    const parsedDateOfBirth = user.dateOfBirth ? parseISO(user.dateOfBirth) : null;
    const validDateOfBirth =
      parsedDateOfBirth && !Number.isNaN(parsedDateOfBirth.getTime())
        ? parsedDateOfBirth
        : new Date();
    const avatarIndex = DEFAULT_AVATARS.findIndex(
      (avatar) => avatar === user.avatarUrl
    );
    const greyAvatarIndex = DEFAULT_AVATARS.findIndex(
      (avatar) => avatar === "/images/defaultpfp_grey.jpg"
    );
    if (avatarPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    if (backgroundImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(backgroundImagePreviewUrl);
    }
    setSelectedAvatarIndex(
      avatarIndex >= 0
        ? avatarIndex
        : greyAvatarIndex >= 0
        ? greyAvatarIndex
        : 0
    );
    setNickname(user.nickname ?? "");
    setUsername(user.username ?? "");
    setBio(user.bio ?? "");
    setLikeStuff(user.likeStuff ?? "");
    setDislikeStuff(user.dislikeStuff ?? "");
    setChooseFromGallery(!!user.avatarUrl && !isDefaultAvatarUrl(user.avatarUrl));
    setAvatarPreviewUrl(
      user.avatarUrl && !isDefaultAvatarUrl(user.avatarUrl)
        ? user.avatarUrl
        : null
    );
    setBackgroundImagePreviewUrl(user.backgroundImageUrl ?? null);
    setAvatarFile(null);
    setBackgroundImageFile(null);
    setCalendarMonthDate(validDateOfBirth);
    setSelectedCalendarDate(validDateOfBirth);
    setSaveDateOfBirth(true);
    setShouldPersistDateOfBirth(false);
    setHideBirthYear(Boolean(user.dateOfBirth) && user.showYearOfBirth === false);
    setShowTime(false);
    const nextParts = getCalendarInputParts(validDateOfBirth);
    setCalendarDayInput(nextParts.day);
    setCalendarMonthInput(nextParts.month);
    setCalendarYearInput(nextParts.year);
  };
  const handleCloseWithoutSaving = () => {
    resetProfileEditValues();
    setSettingsMenu(null);
    setIsPreviewOpen(false);
    setCloseConfirmDialogOpen(false);
    closeEditProfile();
  };
  const openAvatarPicker = () => {
    setChooseFromGallery(true);
    playNavigationSound();
    avatarInputRef.current?.click();
  };
  const openBackgroundImagePicker = () => {
    backgroundImageInputRef.current?.click();
  };
  const syncCalendarFromInputs = (dayValue: string, monthValue: string, yearValue: string) => {
    const parsedDate = parseCalendarInputParts(dayValue, monthValue, yearValue);
    if (!parsedDate) return;
    if (parsedDate.getTime() > today.getTime() || parsedDate.getTime() < minDate.getTime()) return;
    setSelectedCalendarDate(parsedDate);
    setCalendarMonthDate(parsedDate);
  };
  const handleCalendarDayChange = (value: string) => {
    const nextValue = value.replace(/\D/g, "").slice(0, 2);
    setCalendarDayInput(nextValue);
    syncCalendarFromInputs(nextValue, calendarMonthInput, calendarYearInput);
  };
  const handleCalendarMonthChange = (value: string) => {
    const nextValue = value.replace(/\D/g, "").slice(0, 2);
    setCalendarMonthInput(nextValue);
    syncCalendarFromInputs(calendarDayInput, nextValue, calendarYearInput);
  };
  const handleCalendarYearChange = (value: string) => {
    const nextValue = value.replace(/\D/g, "").slice(0, 4);
    setCalendarYearInput(nextValue);
    syncCalendarFromInputs(calendarDayInput, calendarMonthInput, nextValue);
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Choose an image file only.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });
    event.target.value = "";
  };
  const handleBackgroundImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Choose an image file only.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setBackgroundImageFile(file);
    setBackgroundImagePreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });
    event.target.value = "";
  };

  const previewAvatarUrl =
    avatarPreviewUrl ??
    (user.avatarUrl && !isDefaultAvatarUrl(user.avatarUrl) ? user.avatarUrl : null) ??
    "/images/no_photo.png";
  const effectiveBackgroundImageUrl = backgroundImagePreviewUrl ?? user.backgroundImageUrl;
  const previewProfileUser: User = {
    ...user,
    nickname,
    username,
    avatarUrl: chooseFromGallery ? (avatarPreviewUrl ?? user.avatarUrl ?? null) : DEFAULT_AVATARS[selectedAvatarIndex],
    backgroundImageUrl: effectiveBackgroundImageUrl,
    bio: bio.trim() ? bio : null,
    likeStuff: likeStuff.trim() ? likeStuff : null,
    dislikeStuff: dislikeStuff.trim() ? dislikeStuff : null,
    dateOfBirth: shouldPersistDateOfBirth
      ? saveDateOfBirth && isBirthDateValid && parsedBirthDate
        ? format(parsedBirthDate, "yyyy-MM-dd")
        : null
      : (user.dateOfBirth ?? null),
    showYearOfBirth: shouldPersistDateOfBirth
      ? !(hideBirthYear || (saveDateOfBirth && isBirthDateValid && parsedBirthDate ? (() => {
          const sixYearsAgo = new Date(today);
          sixYearsAgo.setFullYear(today.getFullYear() - 6);
          return parsedBirthDate.getTime() > sixYearsAgo.getTime();
        })() : false))
      : user.showYearOfBirth,
  };
  const hasUnsavedChanges =
    nickname.trim() !== (user.nickname ?? "").trim() ||
    username.trim().toLowerCase() !== (user.username ?? "").trim().toLowerCase() ||
    bio.trim() !== (user.bio ?? "").trim() ||
    likeStuff.trim() !== (user.likeStuff ?? "").trim() ||
    dislikeStuff.trim() !== (user.dislikeStuff ?? "").trim() ||
    previewProfileUser.dateOfBirth !== (user.dateOfBirth ?? null) ||
    previewProfileUser.showYearOfBirth !== user.showYearOfBirth ||
    (chooseFromGallery
      ? (avatarPreviewUrl ?? null) !== (user.avatarUrl ?? null) || !!avatarFile
      : DEFAULT_AVATARS[selectedAvatarIndex] !== (user.avatarUrl ?? null)) ||
    (effectiveBackgroundImageUrl ?? null) !== (user.backgroundImageUrl ?? null) ||
    !!backgroundImageFile;

  const MIN_W = 25;
  const MAX_W = 50;
  const MIN_H = 50;
  const MAX_H = 100;
  const togglePreviewProfile = () => {
    if (isPreviewOpen) return;
    setPreviewPosition({ x: position.x + 420, y: position.y + 10 });
    setPreviewZIndex(getNextWindowZIndex());
    setIsPreviewOpen(true);
  };
  const handleSaveProfileChanges = async () => {
    const formData = new FormData();
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedNickname = nickname.trim();
    const nextAvatarUrl = chooseFromGallery
      ? avatarFile
        ? ""
        : (avatarPreviewUrl ?? user.avatarUrl ?? "")
      : DEFAULT_AVATARS[selectedAvatarIndex];
    const nextBackgroundImageUrl = backgroundImageFile ? "" : (effectiveBackgroundImageUrl ?? "");

    formData.append("username", normalizedUsername);
    formData.append("nickname", normalizedNickname);
    formData.append("bio", bio.trim());
    formData.append("dateOfBirth", previewProfileUser.dateOfBirth ?? "");
    formData.append("showYearOfBirth", previewProfileUser.showYearOfBirth ? "true" : "false");
    formData.append("likeStuff", likeStuff.trim());
    formData.append("dislikeStuff", dislikeStuff.trim());
    if (nextAvatarUrl) {
      formData.append("avatarUrl", nextAvatarUrl);
    }
    if (nextBackgroundImageUrl) {
      formData.append("backgroundImageUrl", nextBackgroundImageUrl);
    }

    if (chooseFromGallery && avatarFile) {
      formData.append("avatarFile", avatarFile);
    }

    if (backgroundImageFile) {
      formData.append("backgroundImageFile", backgroundImageFile);
    }

    try {
      const res = await fetch("/api/auth/save-profile", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.code === "USERNAME_ALREADY_TAKEN") {
          alert(data?.message ?? "Username is already taken.");
          return;
        }
        alert(data?.message ?? "Failed to save profile.");
        return;
      }

      window.dispatchEvent(
        new CustomEvent("aeroworld-profile-updated", {
          detail: data.user,
        })
      );
      setSettingsMenu(null);
      setIsPreviewOpen(false);
      closeEditProfile();
    } catch {
      alert("Failed to save profile.");
    }
  };

  const handleResize = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    document.body.style.userSelect = "none";
    setSettingsMenu(null);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = position.x;
    const startPosY = position.y;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const onMouseMove = (ev: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      if (direction.includes("right")) {
        newWidth = startWidth + ((ev.clientX - startX) / viewportW) * 100;
      }

      if (direction.includes("left")) {
        newWidth = startWidth - ((ev.clientX - startX) / viewportW) * 100;
      }

      if (direction.includes("bottom")) {
        newHeight = startHeight + ((ev.clientY - startY) / viewportH) * 100;
      }

      if (direction.includes("top")) {
        newHeight = startHeight - ((ev.clientY - startY) / viewportH) * 100;
      }

      newWidth = Math.min(MAX_W, Math.max(MIN_W, newWidth));
      newHeight = Math.min(MAX_H, Math.max(MIN_H, newHeight));

      if (direction.includes("left")) {
        const startWidthPx = (startWidth / 100) * viewportW;
        const newWidthPx = (newWidth / 100) * viewportW;
        newX = startPosX + (startWidthPx - newWidthPx);
      }

      if (direction.includes("top")) {
        const startHeightPx = (startHeight / 100) * viewportH;
        const newHeightPx = (newHeight / 100) * viewportH;
        newY = startPosY + (startHeightPx - newHeightPx);
      }

      if (newX + (newWidth / 100) * viewportW > viewportW) {
        newX = viewportW - (newWidth / 100) * viewportW;
      }
      if (newX < 0) {
        newX = 0;
      }
      if (newY + (newHeight / 100) * viewportH > viewportH) {
        newY = viewportH - (newHeight / 100) * viewportH;
      }
      if (newY < 0) {
        newY = 0;
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      ref={frameRef}
      className={`aero-frame more-transparent${isMinimizing ? " window-minimizing" : ""}`}
        style={{
        zIndex: `${zIndex}`,
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${size.width}vw`,
        height: `${size.height}vh`,
        position: "absolute",
      }}
      onMouseDown={() => setZIndex(getNextWindowZIndex())}
    >
      <div className={styles["aero-frame-header"]} onMouseDown={handleMouseDown}>
        <span className="aero-title">@{ user.username }</span>
        <div className="header-control-buttons">
          <button className="aero-buttons-blue aero-button-minimize"  onClick={handleMinimize}/>
          <button className="aero-buttons-blue aero-button-maximize"/>
          <button className="aero-button-close"  onClick={() => {
            if (!hasUnsavedChanges) {
              handleCloseWithoutSaving();
              return;
            }
            setCloseConfirmDialogOpen(true);
          }}/>
        </div>
      </div>
      <div
        className={styles["profile-window"]}
        onClick={(e) => e.stopPropagation()}
        style={effectiveBackgroundImageUrl ? {
        backgroundImage: `url(${effectiveBackgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      } : undefined}>
        <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          hidden
          title="Choose pfp"
          onChange={handleAvatarChange}
        />
        <input
          ref={backgroundImageInputRef}
          type="file"
          accept="image/*"
          hidden
          title="Choose profile background"
          onChange={handleBackgroundImageChange}
        />
        <div
          ref={profileWindowScrollRef}
          className={styles["profile-window-scroll"]}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            if (
              target?.closest(".menu, .menu-item") ||
              target?.closest("input, textarea, button, label") ||
              target?.closest(`.${styles["about-user"]}`) ||
              target?.closest(`.${styles["date-of-birth"]}`) ||
              target?.closest(`.${styles["default-avatars-rail"]}`) ||
              target?.closest(`.${styles["default-avatars-controls"]}`) ||
              target?.closest(`.${styles["selected-avatar-preview-button"]}`) ||
              target?.closest(`.${styles["choose-from-gallery"]}`) ||
              target?.closest(`.${styles["set-background"]} img`) ||
              target?.closest(`.${styles["set-background"]} span`)
            ) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (settingsMenu) {
              setSettingsMenu(null);
              return;
            }
            const wrapperRect = frameRef.current?.getBoundingClientRect();
            const x = wrapperRect ? event.clientX - wrapperRect.left : event.clientX;
            const y = wrapperRect ? event.clientY - wrapperRect.top : event.clientY;
            setSettingsMenu({ x, y, isPositioned: false });
          }}
          style={effectiveBackgroundImageUrl ? { background: "transparent" } : undefined}
        >
          <div className={styles["edit-avatar-container"]}>
            <div className={styles["default-avatars-section"]}>
              <div className={`${styles["default-avatars-rail"]}${avatarAnimationDirection ? ` ${styles[`slide-${avatarAnimationDirection}`]}` : ""}${chooseFromGallery ? ` ${styles["disabled"]}` : ""}`}>
                {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((offset) => (
                  <div
                    key={`${getAvatarAt(offset)}-${offset}`}
                    className={`${styles["default-avatar-option"]}${offset === 0 ? ` ${styles["active"]}` : ""}`}
                  >
                    <img src={getAvatarAt(offset)}/>
                  </div>
                ))}
              </div>
              <div className={`${styles["default-avatars-controls"]}${chooseFromGallery ? ` ${styles["disabled"]}` : ""}`}>
                <img src="/images/AeroCircle01.png" className={`${styles["default-avatars-arrow"]} ${styles["mirrored"]}`} onClick={() => {
                  if (chooseFromGallery) return;
                  playNavigationSound();
                  moveAvatarSelection(-1);
                }}/>
                <img src="/images/AeroCircle01.png" className={styles["default-avatars-arrow"]} onClick={() => {
                  if (chooseFromGallery) return;
                  playNavigationSound();
                  moveAvatarSelection(1);
                }}/>
              </div>
            </div>
            <div className={styles["selected-avatar-preview"]}>
              <button
                type="button"
                className={styles["selected-avatar-preview-button"]}
                onClick={openAvatarPicker}
                disabled={!chooseFromGallery}
                style={!chooseFromGallery ? { cursor: "default" } : undefined}
              >
                <div className={`${styles["default-avatar-option"]} ${styles["active"]}`}>
                  <img src={previewAvatarUrl} style={!chooseFromGallery ? { opacity: 0.6 } : undefined}/>
                </div>
              </button>
              <label className={`${styles["choose-from-gallery"]}${!chooseFromGallery ? ` ${styles["inactive"]}` : ""}`} onClick={(event) => {
                if (!chooseFromGallery) return;
                const target = event.target as HTMLElement | null;
                if (target?.closest("input")) return;
                event.preventDefault();
                openAvatarPicker();
              }}>
                <input
                  type="checkbox"
                  className={styles["choose-from-gallery-checkbox"]}
                  checked={chooseFromGallery}
                  onChange={(event) => {
                    playNavigationSound();
                    setChooseFromGallery(event.target.checked);
                  }}
                />
                <span>загрузить фото</span>
              </label>
            </div>
          </div>
        <div className={styles["about-user-container"]}>
          <div className={styles["about-user-section"]}>
            <input type="text" maxLength={25} className={`retro-input ${styles["about-user-single-line-input"]}`} value={nickname} placeholder={user.nickname ?? "Nickname"} onChange={(event) => setNickname(event.target.value.replace(/[\r\n]+/g, ""))}/>
            <input type="text" maxLength={15} className={`retro-input ${styles["about-user-single-line-input"]}`} value={username} placeholder={user.username} onChange={(event) => setUsername(event.target.value.replace(/[\r\n]+/g, ""))}/>
            <div className={styles["about-user"]}>
                <div className={styles["about-user-header"]}>Обо мне:</div>
                <div className={styles["about-user-input-wrap"]}>
                  <textarea ref={bioRef} rows={1} maxLength={250} className={styles["about-user-input"]} value={bio} placeholder={aboutPlaceholder} onChange={(event) => {
                    const { normalized, nextSelection } = normalizeTextareaValue(event.target.value, event.target.selectionStart);
                    setBio(normalized);
                    requestAnimationFrame(() => {
                      if (!bioRef.current) return;
                      bioRef.current.setSelectionRange(nextSelection, nextSelection);
                    });
                  }}/>
                </div>
            </div>
            <div className={styles["about-user"]}>
                <div className={styles["about-user-header"]}>Вещи, которые я люблю:</div>
                    <div className={styles["about-user-input-wrap"]}>
                      <textarea ref={likeStuffRef} rows={1} maxLength={250} className={styles["about-user-input"]} value={likeStuff} placeholder={aboutPlaceholder} onChange={(event) => {
                        const { normalized, nextSelection } = normalizeTextareaValue(event.target.value, event.target.selectionStart);
                        setLikeStuff(normalized);
                        requestAnimationFrame(() => {
                          if (!likeStuffRef.current) return;
                          likeStuffRef.current.setSelectionRange(nextSelection, nextSelection);
                        });
                      }}/>
                    </div>
            </div>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Вещи, которые я не люблю:</div>
              <div className={styles["about-user-input-wrap"]}>
                <textarea ref={dislikeStuffRef} rows={1} maxLength={250} className={styles["about-user-input"]} value={dislikeStuff} placeholder={aboutPlaceholder} onChange={(event) => {
                  const { normalized, nextSelection } = normalizeTextareaValue(event.target.value, event.target.selectionStart);
                  setDislikeStuff(normalized);
                  requestAnimationFrame(() => {
                    if (!dislikeStuffRef.current) return;
                    dislikeStuffRef.current.setSelectionRange(nextSelection, nextSelection);
                  });
                }}/>
              </div>
            </div>
          </div>
          <div className={styles["date-of-birth"]} data-should-persist-date-of-birth={shouldPersistDateOfBirth ? "true" : "false"} onClick={() => setShouldPersistDateOfBirth(true)}>
            <div className={styles["date-of-birth-title"]}>Дата рождения</div>
            <div className={styles["date-of-birth-bottom"]}>
              <div className={styles["calendar"]}>
                <div className={styles["calendar-top"]}>
                  <button type="button" className={styles["calendar-nav-button"]} 
                          onClick={() =>{
                            setCalendarMonthDate((current) => subMonths(current, 1));
                            playNavigationSound();
                          }}
                  >◀</button>
                  <div className={styles["calendar-title-block"]}>
                    <div className={styles["calendar-month-title"]}>{format(calendarMonthDate, "MMMM yyyy")}</div>
                  </div>
                  <button type="button" 
                    className={styles["calendar-nav-button"]} 
                    onClick={() => {
                      playNavigationSound();
                      setCalendarMonthDate((current) => addMonths(current, 1));
                    }}
                    style={{padding: '0 0 0 2px'}}                  
                  >▶</button>
                </div>
                <div className={styles["calendar-weekdays"]}>
                  {CALENDAR_WEEK_DAYS.map((day) => (
                    <div key={day} className={styles["calendar-weekday"]}>{day}</div>
                  ))}
                </div>
                <div className={styles["calendar-grid"]}>
                  {calendarDays.map((day) => {
                    const inCurrentMonth = isSameMonth(day, calendarMonthDate);
                    const isSelected = isSameDay(day, selectedCalendarDate);
                    const isFutureDay = day.getTime() > today.getTime();
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={!inCurrentMonth || isFutureDay}
                        className={`${styles["calendar-day"]}${!inCurrentMonth ? ` ${styles["outside-month"]}` : ""}${isSelected ? ` ${styles["selected"]}` : ""}`}
                        onClick={() => {
                          if (isFutureDay) return;
                          setSelectedCalendarDate(day);
                          setCalendarMonthDate(day);
                          const nextParts = getCalendarInputParts(day);
                          setCalendarDayInput(nextParts.day);
                          setCalendarMonthInput(nextParts.month);
                          setCalendarYearInput(nextParts.year);
                        }}
                      >
                        {inCurrentMonth ? format(day, "d") : ""}
                      </button>
                    );
                  })}
                </div>
                <div className={styles["calendar-footer-nav"]}>
                  <span
                    title={saveDateOfBirth ? "Не сохранять дату как ДР" : "Сохранить дату как ДР"}
                    onClick={() => { setSaveDateOfBirth((prev) => !prev); }}
                    style={{ cursor: "pointer" }}
                  >*</span>
                  <span 
                    style={{ display: 'inline-block', transform: showTime ? 'none' : 'scaleY(-1) translateY(4px)' }}
                    onClick={() => { setShowTime((prev) => !prev); }}
                  >^</span>
                  <span title='На сегодняшнее число' onClick={() => {
                    const today = new Date();
                    setSelectedCalendarDate(today);
                    setCalendarMonthDate(today);
                    const nextParts = getCalendarInputParts(today);
                    setCalendarDayInput(nextParts.day);
                    setCalendarMonthInput(nextParts.month);
                    setCalendarYearInput(nextParts.year);
                  }}>&gt;&gt;&gt;</span>
                </div>
                <div className={styles["calendar-footer-row"]}>
                  <span>Выберите дату:</span>
                  <span style={{display: showTime ? 'unset' : 'none'}}>{format(calendarNow, "HH:mm")}</span>
                </div>
                <div className={styles["calendar-footer-row"]}>
                  <div className={`${styles["calendar-date-inputs"]}${!saveDateOfBirth ? ` ${styles["disabled"]}` : ""}`}>
                    <input type="text" inputMode="numeric" value={calendarDayInput} placeholder="" className={styles["calendar-date-input"]} disabled={!saveDateOfBirth} onChange={(event) => handleCalendarDayChange(event.target.value)}/>
                    <span className={styles["dot"]}>.</span>
                    <input type="text" inputMode="numeric" value={calendarMonthInput} placeholder="" className={styles["calendar-date-input"]} disabled={!saveDateOfBirth} onChange={(event) => handleCalendarMonthChange(event.target.value)}/>
                    <span className={styles["dot"]}>.</span>
                    <input type="text" inputMode="numeric" value={calendarYearInput} placeholder="" className={`${styles["calendar-date-input"]} ${styles["year"]}`} disabled={!saveDateOfBirth} onChange={(event) => handleCalendarYearChange(event.target.value)}/>
                    {isBirthDateInputComplete && !isBirthDateValid ? <span className={styles["birth-date-valid-sign"]} title='Неверная дата'>!</span> : null}
                  </div>
                </div>
                <div className={`${styles["show-birth-year-block"]}${!saveDateOfBirth ? ` ${styles["disabled"]}` : ""}`}>
                  <input type="checkbox" checked={hideBirthYear} disabled={!saveDateOfBirth} onChange={(event) => {
                    playNavigationSound();
                    setHideBirthYear(event.target.checked);
                  }}/>
                  <span>Не показывать мой год рождения</span>
                </div>
              </div>
            </div>
          </div>
          </div>
          <div className={styles["set-background"]}>
              <img src='/images/154.png' onClick={openBackgroundImagePicker}/>
              <span onClick={openBackgroundImagePicker}>Фоновое изображение профиля</span>
            </div>
        </div>
                    
        <div className={styles["profile-window-bottom"]} onClick={(event) => {
          const target = event.target as HTMLElement | null;
          const image = target?.closest("img");
          if (image?.getAttribute("src") === "/images/profile-preview.png") {
            togglePreviewProfile();
          }
        }}>
          <img src="/images/profile-preview.png" className={styles["profile-window-bottom-action"]} title='Предпросмотр' onClick={playNavigationSound}/>
          <img src="/images/reset-changes.png"  className={styles["profile-window-bottom-action"]} title='Сбросить' onClick={() => {resetProfileEditValues(); playNavigationSound();}}/>
          <img src="/images/save-changes.png"  className={styles["profile-window-bottom-action"]} title='Сохранить изменения' onClick={() => {void handleSaveProfileChanges(); playNavigationSound();}}/>
        </div>
      </div>

      {settingsMenu && (
        <div
          ref={settingsMenuRef}
          className="menu"
          style={{
            left: settingsMenu.x,
            top: settingsMenu.y,
            visibility: settingsMenu.isPositioned ? "visible" : "hidden",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setSettingsMenu(null);
              openBackgroundImagePicker();
            }}
          >
            Установить фон
          </button>
        </div>
      )}
      {typeof document !== "undefined" && closeConfirmDialogOpen &&
        createPortal(
          <div className="delete-dialog-backdrop" onClick={() => setCloseConfirmDialogOpen(false)}>
            <div className="delete-dialog-frame" onClick={(event) => event.stopPropagation()}>
              <div className="delete-dialog">
                <div className="delete-dialog-actions">
                  <button
                    type="button"
                    className="delete-option"
                    onClick={() => { playNavigationSound(); void handleSaveProfileChanges(); setCloseConfirmDialogOpen(false); }}
                  >
                    <span className="delete-option-glare"></span>
                    Сохранить изменения
                  </button>
                  <button
                    type="button"
                    className="delete-option"
                    onClick={() => { playNavigationSound(); setCloseConfirmDialogOpen(false); handleCloseWithoutSaving(); }}
                  >
                    <span className="delete-option-glare"></span>
                    Не сохранять
                  </button>
                  <button type="button" className="delete-option cancel" onClick={() => { playNavigationSound(); setCloseConfirmDialogOpen(false); }}>
                    <span className="delete-option-glare"></span>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      <div className="resize-left" onMouseDown={(e) => handleResize(e as any, "left")} />
      <div className="resize-right" onMouseDown={(e) => handleResize(e as any, "right")} />
      <div className="resize-top" onMouseDown={(e) => handleResize(e as any, "top")} />
      <div className="resize-bottom" onMouseDown={(e) => handleResize(e as any, "bottom")} />
      <div className="resize-tl" onMouseDown={(e) => handleResize(e as any, "top left")} />
      <div className="resize-tr" onMouseDown={(e) => handleResize(e as any, "top right")} />
      <div className="resize-bl" onMouseDown={(e) => handleResize(e as any, "bottom left")} />
      <div className="resize-br" onMouseDown={(e) => handleResize(e as any, "bottom right")} />
      {typeof document !== "undefined" && createPortal(
        <UserProfile
          previewUser={previewProfileUser}
          previewOpen={isPreviewOpen}
          onPreviewClose={() => setIsPreviewOpen(false)}
          previewZIndex={previewZIndex}
          initialPosition={previewPosition}
        />,
        document.body
      )}
    </div>
  );
}
