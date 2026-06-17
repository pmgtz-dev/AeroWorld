import './global.scss';
import UserProfile from "@/components/UserProfile/UserProfile";
import UserProfileEdit from "@/components/UserProfile/UserProfileEdit";
import { ProfileModalProvider } from "@/app/_providers/ProfileModalContext";
import { ActiveChatProvider } from "@/app/_providers/ActiveChatContext";
import { EditProfileModalProvider } from "@/app/_providers/EditProfileModalContext";

export const metadata = {
  title: 'AeroWorld',
  description: 'AeroWorld — Анонимная Социальная Платформа',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <ActiveChatProvider>
          <EditProfileModalProvider>
            <ProfileModalProvider>
              {children}
              <UserProfile />
              <UserProfileEdit />
            </ProfileModalProvider>
          </EditProfileModalProvider>
        </ActiveChatProvider>
      </body>
    </html>
  );
}
