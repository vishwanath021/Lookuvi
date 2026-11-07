/**
 * WhatsApp template wording for Lookuvi.
 * This file only records the text. It does not call Meta and it does not send messages.
 *
 * lookuvi_reminder_points is not approved. Come-back reminders for a customer with
 * points stay on the existing 3-variable reminder and are not sent until this
 * template is approved outside this script.
 */
const templates = [
  {
    name: "lookuvi_reminder",
    submit: false,
    body: "Time for your next visit at {{1}}? Join the queue from home: {{2}} Try a look: {{3}} Reply STOP to opt out.",
  },
  {
    name: "lookuvi_reminder_points",
    submit: false,
    body: "Time for your next visit at {{1}}? You have {{2}} points at {{1}}. Join the queue from home: {{3}} Try a look: {{4}} Reply STOP to opt out.",
    example: "Time for your next visit at Demo Salon? You have 7 points at Demo Salon. Join the queue from home: https://lookuvi.in/s/demo/queue Try a look: https://lookuvi.in/s/demo Reply STOP to opt out.",
  },
];

const pending = templates.filter((template) => template.name === "lookuvi_reminder_points");
console.log(JSON.stringify({ note: "Not submitted to Meta.", pending }, null, 2));
