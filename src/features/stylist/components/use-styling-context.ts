import { useState } from "react";

export function useStylingContext(initialDate: string) {
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState("");
  const [occasion, setOccasion] = useState("");
  const [targetFormality, setTargetFormality] = useState("");
  const [indoorOutdoor, setIndoorOutdoor] = useState("");

  return {
    message,
    setMessage,
    date,
    setDate,
    location,
    setLocation,
    occasion,
    setOccasion,
    targetFormality,
    setTargetFormality,
    indoorOutdoor,
    setIndoorOutdoor,
  };
}
