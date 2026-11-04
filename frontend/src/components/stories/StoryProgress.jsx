export default function StoryProgress({ count, currentIndex, progress }) {
  const currentProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="story-progress" aria-label="Story progress">
      {Array.from({ length: count }, (_, index) => {
        const width =
          index < currentIndex
            ? "100%"
            : index === currentIndex
              ? `${currentProgress}%`
              : "0%";

        return (
          <div
            key={index}
            className="story-progress__item"
            role="progressbar"
            aria-label={`Story ${index + 1} of ${count}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              index < currentIndex
                ? 100
                : index === currentIndex
                  ? currentProgress
                  : 0
            }
          >
            <div
              className="story-progress__bar"
              style={{ width }}
            />
          </div>
        );
      })}
    </div>
  );
}
