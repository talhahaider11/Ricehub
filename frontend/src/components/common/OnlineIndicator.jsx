export default function OnlineIndicator({
  online,
}) {
  return (
    <span
      className={
        online
          ? "online-indicator online"
          : "online-indicator"
      }
      title={
        online
          ? "Online"
          : "Offline"
      }
    />
  );
}