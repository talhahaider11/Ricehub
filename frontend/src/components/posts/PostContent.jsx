import {
  Link,
} from "react-router-dom";

export default function PostContent({
  content,
}) {
  if (!content) return null;

  const parts =
    content.split(
      /(#(?:[a-zA-Z0-9_]+))/
    );

  return (
    <p className="post-content">
      {parts.map(
        (part, index) => {
          if (
            part.startsWith("#")
          ) {
            const tag =
              part.substring(1);

            return (
              <Link
                key={index}
                to={`/search?q=${encodeURIComponent(
                  part
                )}`}
                className="hashtag"
              >
                {part}
              </Link>
            );
          }

          return (
            <span key={index}>
              {part}
            </span>
          );
        }
      )}
    </p>
  );
}