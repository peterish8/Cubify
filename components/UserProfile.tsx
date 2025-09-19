import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface User {
  name: string
  profilePicUrl?: string
}

interface UserProfileProps {
  user: User
  size?: "sm" | "md" | "lg"
}

export function UserProfile({ user, size = "md" }: UserProfileProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  }

  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarImage src={user.profilePicUrl} alt={user.name} />
      <AvatarFallback>
        {user.profilePicUrl ? (
          <img src="/placeholder-user.jpg" alt="placeholder" />
        ) : (
          user.name.charAt(0).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  )
}