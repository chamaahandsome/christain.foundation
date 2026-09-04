// The seeded template library (the Maltivas contract-templates pattern,
// ministry-shaped). Each template's HTML carries
// <span data-field="key">placeholder</span> input sections the editor
// highlights for fill-in; `fields` lists them in order. Seeded per channel
// on the first Business visit; creators edit their copies freely.

export interface DefaultTemplate {
  key: string;
  name: string;
  category: string;
  description: string;
  fields: string[];
  content: string;
}

const f = (key: string, placeholder: string) =>
  `<span data-field="${key}">${placeholder}</span>`;

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "speaking-engagement",
    name: "Speaking Engagement",
    category: "Ministry",
    description: "Preaching or conference speaking: dates, honorarium, travel, recording rights.",
    fields: [
      "hostName", "hostAddress", "speakerName", "effectiveDate", "eventName",
      "eventDate", "eventLocation", "sessionCount", "topic", "honorarium",
      "travelTerms", "recordingTerms", "cancellationDays",
    ],
    content:
      `<h1>Speaking Engagement Agreement</h1>` +
      `<p>This agreement is made between ${f("hostName", "Host church / organization")} of ${f("hostAddress", "Host address")} ("Host") and ${f("speakerName", "Speaker's full name")} ("Speaker"), effective ${f("effectiveDate", "Effective date")}.</p>` +
      `<h2>The engagement</h2>` +
      `<p>Speaker will minister at ${f("eventName", "Event name")} on ${f("eventDate", "Event date(s)")} at ${f("eventLocation", "Venue, city")}, delivering ${f("sessionCount", "number")} session(s) on ${f("topic", "topic / passage")}.</p>` +
      `<h2>Honorarium &amp; travel</h2>` +
      `<p>Host will provide an honorarium of $${f("honorarium", "Amount")}, paid on or before the event date. ${f("travelTerms", "Travel, lodging, and meals: who books and who pays")}.</p>` +
      `<h2>Recording &amp; usage</h2>` +
      `<p>${f("recordingTerms", "May the Host record and publish the sessions? Where? Does the Speaker retain the right to publish on their own channels?")}</p>` +
      `<h2>Cancellation</h2>` +
      `<p>Either party may cancel with ${f("cancellationDays", "number")} days' written notice. If the Host cancels inside that window, pre-booked travel costs are reimbursed.</p>` +
      `<h2>Conduct &amp; doctrine</h2>` +
      `<p>Speaker will minister in accordance with the doctrinal statement affirmed on their Christian Foundation channel.</p>`,
  },
  {
    key: "ministry-sow",
    name: "Statement of Work",
    category: "Ministry",
    description: "Scope, deliverables, timeline, and payment for a defined piece of work.",
    fields: [
      "clientName", "providerName", "effectiveDate", "startDate", "endDate",
      "service1", "service2", "deliverable1", "deliverable2", "totalAmount",
      "terminationNoticeDays",
    ],
    content:
      `<h1>Statement of Work</h1>` +
      `<p>This Statement of Work is made between ${f("clientName", "Client name")} ("Client") and ${f("providerName", "Provider name")} ("Provider"), effective ${f("effectiveDate", "Effective date")}. Services commence ${f("startDate", "Start date")} and conclude ${f("endDate", "End date")}.</p>` +
      `<h2>Services</h2><ul>` +
      `<li>${f("service1", "Description of services to be performed")}</li>` +
      `<li>${f("service2", "Description of services to be performed")}</li></ul>` +
      `<h2>Deliverables &amp; deadlines</h2><ul>` +
      `<li>${f("deliverable1", "Deliverable and deadline")}</li>` +
      `<li>${f("deliverable2", "Deliverable and deadline")}</li></ul>` +
      `<h2>Payment</h2>` +
      `<p>The total fee is $${f("totalAmount", "Total amount")}. Additional expenses (travel, materials) must be pre-approved by the Client.</p>` +
      `<h2>Confidentiality</h2>` +
      `<p>Both parties keep confidential information shared during the work strictly confidential.</p>` +
      `<h2>Termination</h2>` +
      `<p>Either party may terminate with ${f("terminationNoticeDays", "number")} days' written notice; work completed to date is payable.</p>`,
  },
  {
    key: "worship-set",
    name: "Worship / Music Ministry",
    category: "Ministry",
    description: "A worship leader or band serving an event: sets, sound, rehearsal, honorarium.",
    fields: [
      "hostName", "artistName", "effectiveDate", "eventName", "eventDate",
      "eventLocation", "setDetails", "soundTerms", "rehearsalTerms",
      "honorarium", "travelTerms", "cancellationDays",
    ],
    content:
      `<h1>Worship Ministry Agreement</h1>` +
      `<p>Between ${f("hostName", "Host church / event")} ("Host") and ${f("artistName", "Worship leader / band")} ("Artist"), effective ${f("effectiveDate", "Effective date")}.</p>` +
      `<h2>The ministry</h2>` +
      `<p>Artist will lead worship at ${f("eventName", "Event")} on ${f("eventDate", "Date(s)")} at ${f("eventLocation", "Venue, city")}: ${f("setDetails", "Number and length of sets, congregational vs performance")}.</p>` +
      `<h2>Sound &amp; rehearsal</h2>` +
      `<p>${f("soundTerms", "Who provides PA, instruments, engineers")}. ${f("rehearsalTerms", "Soundcheck / rehearsal time and access")}.</p>` +
      `<h2>Honorarium &amp; travel</h2>` +
      `<p>Honorarium of $${f("honorarium", "Amount")}. ${f("travelTerms", "Travel, lodging, meals")}.</p>` +
      `<h2>Cancellation</h2>` +
      `<p>Either party may cancel with ${f("cancellationDays", "number")} days' written notice; pre-booked costs are reimbursed if the Host cancels inside the window.</p>`,
  },
  {
    key: "music-licensing",
    name: "Music Licensing",
    category: "Creative",
    description: "License a song or recording for an event, video, or film.",
    fields: [
      "licensorName", "licenseeName", "effectiveDate", "workTitle",
      "usageScope", "territory", "term", "licenseFee", "creditLine",
    ],
    content:
      `<h1>Music License Agreement</h1>` +
      `<p>${f("licensorName", "Rights holder")} ("Licensor") grants ${f("licenseeName", "Licensee")} ("Licensee") a license effective ${f("effectiveDate", "Effective date")} to use ${f("workTitle", "Song / recording title")} (the "Work").</p>` +
      `<h2>Scope</h2>` +
      `<p>${f("usageScope", "Where the Work may be used: event playback, video, film, streaming — and any exclusions")}. Territory: ${f("territory", "Worldwide / specific")}. Term: ${f("term", "Duration of the license")}.</p>` +
      `<h2>Fee</h2>` +
      `<p>Licensee pays $${f("licenseFee", "Amount")} on signing. No further royalties are due within the licensed scope.</p>` +
      `<h2>Credit</h2>` +
      `<p>Licensee will credit the Work as: ${f("creditLine", "Credit line, e.g. “Song — Artist, used by permission”")}.</p>` +
      `<h2>Reservation of rights</h2>` +
      `<p>All rights not expressly granted remain the Licensor's. The license is non-transferable and non-exclusive unless stated above.</p>`,
  },
  {
    key: "appearance-release",
    name: "Appearance Release",
    category: "Creative",
    description: "Permission to film someone and use their appearance in a film or video.",
    fields: [
      "producerName", "participantName", "effectiveDate", "projectTitle",
      "usageScope", "compensation",
    ],
    content:
      `<h1>Appearance Release</h1>` +
      `<p>${f("participantName", "Participant's full name")} ("Participant") grants ${f("producerName", "Producer / channel")} ("Producer"), effective ${f("effectiveDate", "Effective date")}, permission to record and use their appearance, voice, and likeness in ${f("projectTitle", "Project title")}.</p>` +
      `<h2>Usage</h2>` +
      `<p>${f("usageScope", "Where the material may appear: the film, trailers, promotion, platforms — worldwide, in perpetuity unless narrowed here")}.</p>` +
      `<h2>Compensation</h2>` +
      `<p>${f("compensation", "Compensation, or “no compensation — participation is voluntary”")}.</p>` +
      `<h2>Editing</h2>` +
      `<p>Producer may edit the material at their discretion but will not use it in a way that misrepresents the Participant's words or beliefs.</p>`,
  },
  {
    key: "nda",
    name: "Non-Disclosure Agreement",
    category: "Legal",
    description: "Mutual NDA for unreleased projects, manuscripts, and plans.",
    fields: ["partyA", "partyB", "effectiveDate", "purpose", "termYears"],
    content:
      `<h1>Non-Disclosure Agreement</h1>` +
      `<p>Between ${f("partyA", "Party A")} and ${f("partyB", "Party B")}, effective ${f("effectiveDate", "Effective date")}, for the purpose of ${f("purpose", "the discussions / project being protected")}.</p>` +
      `<h2>Confidential information</h2>` +
      `<p>Any non-public information disclosed by either party — manuscripts, scripts, recordings, plans, budgets, unannounced projects — whether written, oral, or electronic, is confidential.</p>` +
      `<h2>Obligations</h2>` +
      `<ul><li>Use confidential information only for the stated purpose.</li>` +
      `<li>Do not disclose it to third parties without written consent.</li>` +
      `<li>Protect it with at least reasonable care.</li></ul>` +
      `<h2>Exclusions</h2>` +
      `<p>Information that is public, already known, independently developed, or lawfully received from another source is not confidential.</p>` +
      `<h2>Term</h2>` +
      `<p>These obligations last ${f("termYears", "number")} years from the effective date.</p>`,
  },
  {
    key: "independent-contractor",
    name: "Independent Contractor",
    category: "Legal",
    description: "Engage a contractor: relationship, scope, payment, ownership of work.",
    fields: [
      "clientName", "contractorName", "effectiveDate", "scope",
      "paymentTerms", "ownershipTerms", "terminationNoticeDays",
    ],
    content:
      `<h1>Independent Contractor Agreement</h1>` +
      `<p>Between ${f("clientName", "Client")} ("Client") and ${f("contractorName", "Contractor")} ("Contractor"), effective ${f("effectiveDate", "Effective date")}.</p>` +
      `<h2>Relationship</h2>` +
      `<p>Contractor is an independent contractor, not an employee; each party bears its own taxes and insurance.</p>` +
      `<h2>Scope</h2><p>${f("scope", "The work to be performed")}</p>` +
      `<h2>Payment</h2><p>${f("paymentTerms", "Amount, schedule, and method")}</p>` +
      `<h2>Ownership</h2><p>${f("ownershipTerms", "Who owns the work product on payment; any license back to the Contractor")}</p>` +
      `<h2>Termination</h2>` +
      `<p>Either party may terminate with ${f("terminationNoticeDays", "number")} days' written notice; work completed to date is payable.</p>`,
  },
];
