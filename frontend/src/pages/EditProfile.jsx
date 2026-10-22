import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import userService from "../services/userService";
import useAuth from "../hooks/useAuth";
import Button from "../components/common/Button";

export default function EditProfile() {
  const {
    user,
    setUser,
  } = useAuth();

  const navigate =
    useNavigate();

  const [form, setForm] =
    useState({
      first_name: "",
      last_name: "",
      bio: "",
      profile_visibility:
        "public",
    });

  const [avatar, setAvatar] =
    useState(null);

  const [cover, setCover] =
    useState(null);

  const [saving, setSaving] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    setForm({
      first_name:
        user.first_name || "",
      last_name:
        user.last_name || "",
      bio: user.bio || "",
      profile_visibility:
        user.profile_visibility ||
        "public",
    });
  }, [user]);

  const update = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const data = new FormData();

    Object.entries(form).forEach(
      ([key, value]) => {
        data.append(key, value);
      }
    );

    if (avatar) {
      data.append(
        "profile_picture",
        avatar
      );
    }

    if (cover) {
      data.append(
        "cover_picture",
        cover
      );
    }

    try {
      setSaving(true);
      setError("");

      const updated =
        await userService.updateMe(data);

      setUser(updated);

      navigate(
        `/profile/${updated.id}`
      );
    } catch (updateError) {
      const responseData = updateError.response?.data;
      const messages =
        responseData && typeof responseData === "object"
          ? Object.values(responseData).flatMap((value) =>
              Array.isArray(value) ? value : [value]
            )
          : [];
      setError(
        messages.filter((value) => typeof value === "string").join(" ") ||
          "Profile could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">

      <form
        className="card form-card"
        onSubmit={submit}
      >
        <h1>Edit Profile</h1>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <label>
          First name
          <input
            value={form.first_name}
            onChange={(event) =>
              update(
                "first_name",
                event.target.value
              )
            }
          />
        </label>

        <label>
          Last name
          <input
            value={form.last_name}
            onChange={(event) =>
              update(
                "last_name",
                event.target.value
              )
            }
          />
        </label>

        <label>
          Bio
          <textarea
            value={form.bio}
            maxLength={500}
            onChange={(event) =>
              update(
                "bio",
                event.target.value
              )
            }
          />
        </label>

        <label>
          Profile visibility
          <select
            value={
              form.profile_visibility
            }
            onChange={(event) =>
              update(
                "profile_visibility",
                event.target.value
              )
            }
          >
            <option value="public">
              Public
            </option>

            <option value="friends">
              Friends
            </option>

            <option value="private">
              Private
            </option>
          </select>
        </label>

        <label>
          Profile picture
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setAvatar(
                event.target.files?.[0] ||
                  null
              )
            }
          />
        </label>

        <label>
          Cover picture
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setCover(
                event.target.files?.[0] ||
                  null
              )
            }
          />
        </label>

        <Button disabled={saving} type="submit">
          {saving
            ? "Saving..."
            : "Save Changes"}
        </Button>

      </form>

    </div>
  );
}