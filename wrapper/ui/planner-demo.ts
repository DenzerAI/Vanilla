import { addDays } from "./planner-dates.mjs";
export type PlannerEvent = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  contactId?: string;
  sourceId?: string;
  source: string;
};
export const demoContact = {
  id: "demo-contact",
  name: "Alex Beispiel",
  company: "Beispielfirma",
  role: "Projektleitung",
  email: "alex@example.invalid",
};
export function demoEvents(today: string): PlannerEvent[] {
  return [
    {
      id: "demo-meeting",
      title: "Projekt abstimmen",
      date: today,
      start: "10:00",
      end: "10:45",
      allDay: false,
      location: "Videogespräch",
      contactId: demoContact.id,
      sourceId: "demo-message",
      source: "Outlook · Beispiel",
    },
    {
      id: "demo-focus",
      title: "Angebot vorbereiten",
      date: today,
      start: "14:00",
      end: "15:00",
      allDay: false,
      location: "",
      contactId: demoContact.id,
      source: "Eigener Kalender · Beispiel",
    },
    {
      id: "demo-followup",
      title: "Rückmeldung zum Angebot",
      date: addDays(today, 2),
      start: "11:00",
      end: "11:30",
      allDay: false,
      location: "Telefonisch",
      contactId: demoContact.id,
      source: "Outlook · Beispiel",
    },
    {
      id: "demo-day",
      title: "Projekttag",
      date: addDays(today, 7),
      start: "",
      end: "",
      allDay: true,
      location: "Vor Ort",
      contactId: demoContact.id,
      source: "Eigener Kalender · Beispiel",
    },
  ];
}
