type UserIconProps = {
  size?: number;
  className?: string;
};

export default function UserIcon({ size = 36, className }: UserIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role="img"
      aria-label="Default profile avatar"
      className={className}
    >
      <circle
        cx="128"
        cy="96"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
      />
      <path
        d="M48 220
           C60 180, 92 152, 128 152
           C164 152, 196 180, 208 220"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
      />
    </svg>
  );
}
