import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { registerPlugin } from "@capacitor/core";
import Avatar from "../components/common/Avatar";
import { useLanguage } from "../context/LanguageContext";
import friendService from "../services/friendService";
import searchService from "../services/searchService";
import userService from "../services/userService";

const AddressBook = registerPlugin("AddressBook");
import {
  countryOptions,
  defaultCountry,
  toInternationalPhone,
} from "../utils/countryCallingCodes";

function normalizePhone(phone, country) {
  const value = String(phone || "").trim();
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) return `+${digits}`;
  if (value.startsWith("00")) return `+${digits.slice(2)}`;
  return toInternationalPhone(digits, country);
}

export default function Suggestions() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [country, setCountry] = useState(defaultCountry);
  const [loading, setLoading] = useState(true);
  const [findingContacts, setFindingContacts] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    searchService.suggestions()
      .then((data) => {
        if (active) setUsers(Array.isArray(data) ? data : data.results || []);
      })
      .catch((loadError) => {
        console.error("Suggested accounts could not be loaded:", loadError);
        if (active) setError("Suggested accounts could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const findContacts = async () => {
    setError("");
    setNotice("");
    setFindingContacts(true);
    try {
      if (Capacitor.getPlatform() === "android") {
        const result = await AddressBook.getPhoneNumbers();
        const phoneNumbers = [...new Set(
          result.phoneNumbers
            .map((phone) => normalizePhone(phone, country))
            .filter((phone) => /^\+[1-9]\d{7,14}$/.test(phone))
        )];
        if (!phoneNumbers.length) {
          setNotice("No phone numbers were available to match.");
          return;
        }
        const matches = await userService.suggestionsByContacts(phoneNumbers);
        setUsers((current) => {
          const knownIds = new Set(current.map((user) => user.id));
          return [...current, ...matches.filter((user) => !knownIds.has(user.id))];
        });
        setNotice(matches.length ? `Found ${matches.length} account(s) in your contacts.` : "No matching accounts were found.");
        return;
      }
      if (!("contacts" in navigator)) {
        setNotice("Contact access is not supported on this device. You can still browse suggestions below.");
        return;
      }
      const phoneNumbers = [...new Set(
        (await navigator.contacts.select(["tel"], { multiple: true }))
          .flatMap((contact) => contact.tel || [])
          .map((phone) => normalizePhone(phone.number || phone, country))
          .filter((phone) => /^\+[1-9]\d{7,14}$/.test(phone))
      )];
      if (!phoneNumbers.length) {
        setNotice("No phone numbers were available to match.");
        return;
      }
      const matches = await userService.suggestionsByContacts(phoneNumbers);
      setUsers((current) => {
        const knownIds = new Set(current.map((user) => user.id));
        return [...current, ...matches.filter((user) => !knownIds.has(user.id))];
      });
      setNotice(matches.length ? `Found ${matches.length} account(s) in your contacts.` : "No matching accounts were found.");
    } catch (contactError) {
      console.error("Contact suggestions could not be loaded:", contactError);
      setError(contactError.response?.data?.detail || "Contacts could not be accessed. Check device permissions and try again.");
    } finally {
      setFindingContacts(false);
    }
  };

  const sendRequest = async (userId) => {
    setSendingId(userId);
    setError("");
    try {
      await friendService.send(userId);
      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Friend request could not be sent.");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="page-container">
      <section className="card suggestions-page">
        <h1>{t("suggestions")}</h1>
        <p>{t("contactsNotice")}</p>
        <div className="suggestions-contact-actions">
          <label>
            {t("contactsCountry")}
            <select value={country} onChange={(event) => setCountry(event.target.value)}>
              {countryOptions.map(({ country: countryCode, callingCode, name }) => (
                <option key={countryCode} value={countryCode}>
                  {name} ({callingCode})
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary" type="button" disabled={findingContacts} onClick={() => void findContacts()}>
            {findingContacts ? "Finding..." : t("findContacts")}
          </button>
        </div>
        {loading && <p>{t("loadingSuggestions")}</p>}
        {error && <p className="settings-error" role="alert">{error}</p>}
        {notice && <p className="settings-status" role="status">{notice}</p>}
        <div className="suggestions-list">
          {users.map((user) => (
            <article className="suggestion" key={user.id}>
              <Avatar user={user} />
              <div>
                <strong>{user.first_name || user.username}</strong>
                <p>@{user.username}</p>
              </div>
              <button
                type="button"
                disabled={sendingId === user.id}
                onClick={() => void sendRequest(user.id)}
              >
                {sendingId === user.id ? "Sending..." : t("addFriend")}
              </button>
            </article>
          ))}
          {!loading && !users.length && <p>{t("noSuggestions")}</p>}
        </div>
      </section>
    </div>
  );
}
