"use client";

import React, { FC, useState } from "react";
import styles from "../../../styles/auth.module.scss";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Login: FC = () => {

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    const res = await fetch("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Ошибка!");
    } else {
      router.push("/home");
    }

    setLoading(false);
  };
  return (
    <div className={styles["auth"]}>
      <img src="/images/welcome.png" alt="welcome" className={styles["register-title"]}/>

      <div className={styles["auth-container"]}>
        <div className={styles["blur-mask"]}></div>
        <div className={styles["form-container"]}>
          <form
            className={styles["register-form"]} onSubmit={handleSubmit}>
            <label className={styles["auth-label"]}>
              Имя пользователя:
              <input
                type="text"
                name="username"
                placeholder="Введите имя..."
                className="retro-input"
              />
            </label>

            <label className={styles["auth-label"]}>
              Пароль:
              <input
                type="password"
                name="password"
                placeholder="Введите пароль..."
                className="retro-input"
              />
            </label>

            <button type="submit" className={styles["register-button"]}>
              <span className={styles["confirm-label"]}>
                {loading ? "Загрузка..." : "Войти"}
              </span>
              
            </button>
            <Link href="/auth/signup" className={styles["change-method"]}>
              У меня еще нет аккаунта!
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;