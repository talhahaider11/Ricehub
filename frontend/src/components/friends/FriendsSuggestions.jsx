import { useEffect, useState } from "react";

import userService from "../../services/userService";
import friendService from "../../services/friendService";
import Avatar from "../common/Avatar";
import { getArrayResults } from "../../utils/arrayResults";

export default function FriendSuggestions() {
  const [users, setUsers] =
    useState([]);

  useEffect(() => {
    userService
      .search("")
      .then((data) =>
        setUsers(
          getArrayResults(data, "Friend suggestions").slice(0, 5)
        )
      )
      .catch((error) =>
        console.error("Friend suggestions could not be loaded:", error)
      );
  }, []);

  const sendRequest = async (
    userId
  ) => {
    await friendService.send(
      userId
    );

    setUsers((current) =>
      current.filter(
        (user) =>
          user.id !== userId
      )
    );
  };

  return (
    <div className="card suggestions">

      <h3>People you may know</h3>

      {users.map((user) => (
        <div
          className="suggestion"
          key={user.id}
        >
          <Avatar user={user} />

          <div>
            <strong>
              {user.username}
            </strong>

            <button
              onClick={() =>
                sendRequest(user.id)
              }
            >
              Add friend
            </button>
          </div>
        </div>
      ))}

    </div>
  );
}