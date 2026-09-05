// The seeded template library (the Maltivas contract-templates pattern,
// ministry-shaped). Each template's HTML carries
// <span data-field="key">placeholder</span> input sections the editor
// highlights for fill-in (`data-filled-by="recipient"` fields are answered
// by the signer on the signing page) and
// <span data-signature-field data-signer> chips that each party's real
// signature replaces. Seeded per channel on the first Business visit and
// refreshed on later visits (defaults are read-only; creator saves become
// new rows).

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
// Filled in by the signer on the signing page
const fr = (key: string, placeholder: string) =>
  `<span data-field="${key}" data-filled-by="recipient">${placeholder}</span>`;
const sig = (signer: "creator" | "client") =>
  `<span data-signature-field="" data-signer="${signer}">✍️ ${
    signer === "creator" ? "Your signature" : "Client signature"
  }</span>`;

const SIGNATURES =
  `<h2>Signatures</h2>` +
  `<p>IN WITNESS WHEREOF, the parties, intending to be legally bound, have executed this Agreement as of the Effective Date. Each signatory represents that they are authorized to bind the party on whose behalf they sign.</p>` +
  `<p><strong>Provider:</strong><br />${sig("creator")}</p>` +
  `<p><strong>Client:</strong><br />${sig("client")}</p>`;

// Standard closing clauses every agreement carries — the "General
// provisions" block (Maltivas-grade boilerplate, plain-English ministry
// register).
const GENERAL_PROVISIONS = (opts?: { governingKey?: string }) =>
  `<h2>General provisions</h2>` +
  `<p><strong>(a) Independent parties.</strong> Nothing in this Agreement creates a partnership, joint venture, employment, or agency relationship between the parties.</p>` +
  `<p><strong>(b) Force majeure.</strong> Neither party is liable for failure or delay caused by events beyond its reasonable control — including natural disaster, illness or incapacity, government action, epidemic, or failure of utilities or travel infrastructure — provided the affected party gives prompt notice and resumes performance as soon as practicable. If the event prevents performance for more than thirty (30) days, either party may terminate on written notice and amounts owed for work already performed remain payable.</p>` +
  `<p><strong>(c) Notices.</strong> Notices under this Agreement must be in writing and are effective when delivered by hand, by email to the address each party has provided (with no bounce received), or three (3) days after posting by registered mail.</p>` +
  `<p><strong>(d) Assignment.</strong> Neither party may assign this Agreement without the other's prior written consent, except to a successor of substantially all of its ministry or business.</p>` +
  `<p><strong>(e) Severability &amp; waiver.</strong> If any provision is held unenforceable, the remainder stays in force and the provision is enforced to the maximum extent permitted. A party's failure to enforce a provision is not a waiver of it.</p>` +
  `<p><strong>(f) Dispute resolution.</strong> The parties will first attempt in good faith to resolve any dispute by direct discussion, in the spirit of Matthew 18:15, and where both parties agree, by Christian mediation, before resorting to litigation.</p>` +
  `<p><strong>(g) Governing law.</strong> This Agreement is governed by the laws of ${f(opts?.governingKey ?? "governingLaw", "State / country")}, without regard to conflict-of-law rules.</p>` +
  `<p><strong>(h) Entire agreement.</strong> This Agreement (with any exhibits referenced in it) is the entire agreement between the parties on its subject and supersedes all prior discussions and understandings. Amendments must be in writing and signed by both parties. It may be executed electronically and in counterparts, each an original.</p>`;

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  /* ───────────────────────── Legal ───────────────────────── */
  {
    key: "independent-contractor",
    name: "Independent Contractor",
    category: "Legal",
    description:
      "Engage a contractor: services, compensation, nondisclosure, IP ownership, termination.",
    fields: [
      "effectiveDate", "clientName", "contractorName", "location", "scope",
      "deliverable1", "deliverable2", "deadline", "compensation", "depositPercent",
      "paymentSchedule", "expenseTerms", "revisionRounds", "terminationNoticeDays",
      "governingLaw",
    ],
    content:
      `<h1>Independent Contractor Agreement</h1>` +
      `<p>THIS INDEPENDENT CONTRACTOR AGREEMENT (the "Agreement"), dated ${f("effectiveDate", "Effective Date")} (the "Effective Date"), is made between ${f("clientName", "Company")} (the "Company") and ${f("contractorName", "Contractor")} (the "Contractor"), with a principal place of business at ${f("location", "Location")}, for the purpose of setting forth the exclusive terms and conditions by which Company desires to acquire Contractor's services.</p>` +
      `<p>In consideration of the mutual obligations specified in this Agreement, the parties, intending to be legally bound hereby, agree to the following:</p>` +
      `<h2>1. Services</h2>` +
      `<p><strong>(a)</strong> Company retains Contractor, and Contractor agrees to perform, the following services (the "Services"): ${f("scope", "Describe the work to be performed")}.</p>` +
      `<p><strong>(b)</strong> Deliverables and deadlines:</p>` +
      `<ul><li>${f("deliverable1", "Deliverable one and its deadline")}</li>` +
      `<li>${f("deliverable2", "Deliverable two and its deadline")}</li></ul>` +
      `<p><strong>(c)</strong> All Services shall be completed no later than ${f("deadline", "Final deadline")}, unless the parties agree in writing to a revised schedule. Contractor shall perform the Services in a professional and workmanlike manner consistent with industry standards.</p>` +
      `<h2>2. Consideration / Compensation</h2>` +
      `<p><strong>(a)</strong> In exchange for the full, prompt, and satisfactory performance of all Services, Company shall pay Contractor, as full and complete compensation, the sum of $${f("compensation", "Compensation")}, of which ${f("depositPercent", "0")}% is payable as a non-refundable deposit on signing and the balance ${f("paymentSchedule", "on completion / in milestones / monthly")}.</p>` +
      `<p><strong>(b)</strong> Invoices are payable within fifteen (15) days of receipt. Amounts more than fifteen (15) days overdue may accrue a late charge of 1.5% per month or the maximum permitted by law, whichever is less, and Contractor may suspend work until the account is current.</p>` +
      `<p><strong>(c)</strong> Contractor is not entitled to any other compensation or benefits from Company. Except as otherwise required by law, Company shall not withhold any sums for social security or other federal, state, or local tax liabilities; all withholdings, liabilities, and contributions are solely Contractor's responsibility. Contractor understands that the Services are not covered by unemployment or workers' compensation laws.</p>` +
      `<p><strong>(d)</strong> Expenses: ${f("expenseTerms", "Which expenses are reimbursable, and whether pre-approval is required")}.</p>` +
      `<h2>3. Revisions &amp; acceptance</h2>` +
      `<p>The fee includes ${f("revisionRounds", "number")} round(s) of reasonable revisions per deliverable. Additional rounds, or changes in scope after approval, are billed separately by written agreement. A deliverable is deemed accepted if Company does not give written notice of specific deficiencies within ten (10) days of delivery.</p>` +
      `<h2>4. Nondisclosure</h2>` +
      `<p>Contractor shall hold in strict confidence all non-public information received from Company — plans, manuscripts, recordings, budgets, donor and member information, unannounced projects — and shall use it only to perform the Services and disclose it only to those with a need to know who are bound by like obligations. This obligation survives the end of this Agreement. On request, Contractor shall return or destroy all confidential materials.</p>` +
      `<h2>5. Intellectual property</h2>` +
      `<p><strong>(a)</strong> Upon full payment, all work product created under this Agreement is the property of Company as a work made for hire; to the extent any work product does not qualify, Contractor hereby irrevocably assigns all right, title, and interest in it to Company.</p>` +
      `<p><strong>(b)</strong> Contractor retains ownership of pre-existing tools, techniques, and materials, and grants Company a perpetual, non-exclusive license to use any that are embedded in the deliverables.</p>` +
      `<p><strong>(c)</strong> Contractor may display the completed work in a professional portfolio unless Company withdraws that permission in writing.</p>` +
      `<h2>6. Independent contractor relationship</h2>` +
      `<p>Contractor is an independent contractor, not an employee, agent, or partner of Company. Contractor controls the manner and means of performing the Services, may perform services for others, and bears their own taxes, insurance, equipment, and expenses unless agreed otherwise in writing.</p>` +
      `<h2>7. Term and termination</h2>` +
      `<p><strong>(a)</strong> Either party may terminate this Agreement with ${f("terminationNoticeDays", "number")} days' written notice. Company shall pay for all Services satisfactorily performed to the date of termination, and Contractor shall deliver all work in progress for which payment is made.</p>` +
      `<p><strong>(b)</strong> Either party may terminate immediately on written notice if the other materially breaches this Agreement and fails to cure within ten (10) days of notice of the breach.</p>` +
      `<h2>8. Warranties, indemnification &amp; liability</h2>` +
      `<p><strong>(a)</strong> Contractor warrants that the deliverables are original (except identified third-party materials properly licensed), do not infringe any third party's rights, and that Contractor has full authority to enter this Agreement.</p>` +
      `<p><strong>(b)</strong> Each party shall indemnify the other against third-party claims arising from its own negligence, willful misconduct, or breach of this Agreement.</p>` +
      `<p><strong>(c)</strong> Except for breaches of Sections 4 and 5 and indemnification obligations, neither party is liable for indirect, incidental, or consequential damages, and each party's total liability is capped at the amounts paid or payable under this Agreement.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "nda",
    name: "Non-Disclosure Agreement",
    category: "Legal",
    description: "Mutual NDA for unreleased projects, manuscripts, and plans.",
    fields: ["partyA", "partyB", "effectiveDate", "purpose", "termYears", "governingLaw"],
    content:
      `<h1>Mutual Non-Disclosure Agreement</h1>` +
      `<p>THIS MUTUAL NON-DISCLOSURE AGREEMENT (the "Agreement"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("partyA", "Party A")} and ${f("partyB", "Party B")} (each a "Party"), who wish to exchange confidential information for the purpose of ${f("purpose", "the discussions / project being protected")} (the "Purpose").</p>` +
      `<h2>1. Confidential information</h2>` +
      `<p><strong>(a)</strong> "Confidential Information" means any non-public information disclosed by either Party — manuscripts, scripts, recordings, compositions, plans, budgets, donor or member data, financial information, and unannounced projects — whether written, oral, electronic, or observed, that a reasonable person would understand to be confidential.</p>` +
      `<p><strong>(b)</strong> Oral disclosures are Confidential Information if identified as confidential at disclosure or summarized in writing within fifteen (15) days.</p>` +
      `<h2>2. Obligations</h2>` +
      `<ul><li>Use Confidential Information only for the Purpose.</li>` +
      `<li>Do not disclose it to any third party without the disclosing Party's prior written consent, except to employees, volunteers, and advisers with a need to know who are bound by obligations at least as protective as these.</li>` +
      `<li>Protect it with at least the care used for one's own confidential information, and never less than reasonable care.</li>` +
      `<li>Notify the disclosing Party promptly of any unauthorized use or disclosure and cooperate in mitigating it.</li></ul>` +
      `<h2>3. Exclusions</h2>` +
      `<p>Information is not Confidential Information to the extent it (a) is or becomes public through no fault of the receiving Party; (b) was already lawfully known without restriction; (c) is independently developed without use of the disclosure; or (d) is lawfully received from another source without duty of confidentiality. Disclosure compelled by law is permitted with prompt notice (where lawful) so the disclosing Party may seek protection, and only to the extent required.</p>` +
      `<h2>4. Ownership; no license; no obligation</h2>` +
      `<p>All Confidential Information remains the property of the disclosing Party. No license or other right is granted by disclosure. Nothing here obliges either Party to proceed with any project or transaction, and either Party may end the discussions at any time. On request, each Party shall return or destroy the other's Confidential Information.</p>` +
      `<h2>5. Term</h2>` +
      `<p>These obligations begin on the Effective Date and last ${f("termYears", "number")} years from each disclosure, except trade secrets, which remain protected as long as they qualify as such.</p>` +
      `<h2>6. Remedies</h2>` +
      `<p>The Parties agree that breach may cause harm money cannot fully repair; the disclosing Party is entitled to seek injunctive relief in addition to any other remedy, without posting bond.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  /* ───────────────────────── Ministry ───────────────────────── */
  {
    key: "speaking-engagement",
    name: "Speaking Engagement",
    category: "Ministry",
    description:
      "Preaching or conference speaking: dates, honorarium, travel, recording rights.",
    fields: [
      "hostName", "hostAddress", "speakerName", "effectiveDate", "eventName",
      "eventDate", "eventLocation", "sessionCount", "sessionLength", "topic",
      "honorarium", "depositAmount", "travelTerms", "lodgingTerms", "avTerms",
      "recordingTerms", "cancellationDays", "governingLaw",
    ],
    content:
      `<h1>Speaking Engagement Agreement</h1>` +
      `<p>THIS SPEAKING ENGAGEMENT AGREEMENT (the "Agreement"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("hostName", "Host church / organization")} of ${fr("hostAddress", "Host address")} (the "Host") and ${f("speakerName", "Speaker's full name")} (the "Speaker").</p>` +
      `<p>The Host desires the Speaker to minister at its event, and the Speaker agrees to do so, on the following terms:</p>` +
      `<h2>1. The engagement</h2>` +
      `<p><strong>(a)</strong> Speaker will minister at ${f("eventName", "Event name")} on ${f("eventDate", "Event date(s)")} at ${f("eventLocation", "Venue, city")}.</p>` +
      `<p><strong>(b)</strong> Speaker will deliver ${f("sessionCount", "number")} session(s) of approximately ${f("sessionLength", "length, e.g. 45 minutes")} each, on ${f("topic", "topic / passage")}. Session titles and any materials for print will be provided to the Host at least fourteen (14) days before the event.</p>` +
      `<p><strong>(c)</strong> Speaker will arrive at the venue at the time the parties agree in writing (no later than one hour before the first session absent other agreement) and will participate in a sound check if requested.</p>` +
      `<h2>2. Honorarium &amp; payment</h2>` +
      `<p><strong>(a)</strong> Host will provide an honorarium of $${f("honorarium", "Amount")}, of which $${f("depositAmount", "0")} is payable on signing to hold the date and the balance is payable on or before the event date. If the deposit is not received within seven (7) days of signing, the date is not held.</p>` +
      `<p><strong>(b)</strong> The honorarium is compensation for ministry services; each party bears its own tax obligations arising from it.</p>` +
      `<h2>3. Travel, lodging &amp; hospitality</h2>` +
      `<p><strong>(a)</strong> Travel: ${f("travelTerms", "Who books and pays for travel; mileage or airfare class if relevant")}.</p>` +
      `<p><strong>(b)</strong> Lodging and meals: ${f("lodgingTerms", "Nights covered, hotel standard, meals provided or per diem")}.</p>` +
      `<h2>4. Facilities &amp; technical requirements</h2>` +
      `<p>Host will provide a working sound system, a suitable platform, and: ${f("avTerms", "Microphone type, projection/slides, confidence monitor, product table, etc.")}. Host is responsible for venue safety, licensing, and event insurance.</p>` +
      `<h2>5. Recording &amp; usage</h2>` +
      `<p><strong>(a)</strong> ${f("recordingTerms", "May the Host record and publish the sessions? On which platforms? Does the Speaker retain the right to publish on their own channels?")}</p>` +
      `<p><strong>(b)</strong> Neither party may edit recordings in a way that misrepresents the other's words or beliefs. Each party will credit the other accurately in any permitted publication.</p>` +
      `<h2>6. Cancellation &amp; rescheduling</h2>` +
      `<p><strong>(a)</strong> Either party may cancel with ${f("cancellationDays", "number")} days' written notice. If the Host cancels inside that window, the deposit is retained and pre-booked, non-refundable travel costs are reimbursed. If the Speaker cancels inside that window other than for a force-majeure event, the deposit is returned.</p>` +
      `<p><strong>(b)</strong> If a force-majeure event prevents the engagement, the parties will first attempt in good faith to reschedule within twelve (12) months before any refund is due.</p>` +
      `<h2>7. Conduct &amp; doctrine</h2>` +
      `<p>Speaker will minister in accordance with the doctrinal statement affirmed on their Christian Foundation channel and with the Host's stated statement of faith to the extent shared in advance. Neither party will publicly misrepresent the other's beliefs or statements. Host will not alter the agreed topic or format without the Speaker's consent.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "ministry-sow",
    name: "Statement of Work",
    category: "Ministry",
    description:
      "Scope, deliverables, timeline, and payment for a defined piece of work.",
    fields: [
      "clientName", "providerName", "effectiveDate", "startDate", "endDate",
      "service1", "service2", "deliverable1", "deliverable2", "milestone1",
      "milestone2", "totalAmount", "depositPercent", "revisionRounds",
      "expenseTerms", "terminationNoticeDays", "governingLaw",
    ],
    content:
      `<h1>Statement of Work</h1>` +
      `<p>THIS STATEMENT OF WORK (the "SOW"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("clientName", "Client name")} (the "Client") and ${f("providerName", "Provider name")} (the "Provider"). Services commence ${f("startDate", "Start date")} and conclude ${f("endDate", "End date")}, unless extended in writing.</p>` +
      `<h2>1. Services</h2>` +
      `<p>Provider shall perform the following services in a professional and workmanlike manner:</p>` +
      `<ul><li>${f("service1", "Description of services to be performed")}</li>` +
      `<li>${f("service2", "Description of services to be performed")}</li></ul>` +
      `<h2>2. Deliverables &amp; schedule</h2>` +
      `<ul><li>${f("deliverable1", "Deliverable one and its deadline")}</li>` +
      `<li>${f("deliverable2", "Deliverable two and its deadline")}</li></ul>` +
      `<p>Milestones: ${f("milestone1", "Milestone one — date and what's due")}; ${f("milestone2", "Milestone two — date and what's due")}. Dates shift day-for-day where Client feedback or materials are late.</p>` +
      `<h2>3. Fees &amp; payment</h2>` +
      `<p><strong>(a)</strong> The total fee is $${f("totalAmount", "Total amount")}, of which ${f("depositPercent", "0")}% is payable on signing and the balance per the milestone schedule above (or on completion if no milestones are set).</p>` +
      `<p><strong>(b)</strong> Invoices are payable within fifteen (15) days. Overdue accounts pause the schedule: Provider may suspend work until the account is current, and deadlines extend accordingly.</p>` +
      `<p><strong>(c)</strong> Expenses: ${f("expenseTerms", "Travel, materials, stock assets — what is reimbursable and whether pre-approval is required")}.</p>` +
      `<h2>4. Revisions &amp; acceptance</h2>` +
      `<p>The fee includes ${f("revisionRounds", "number")} round(s) of revisions per deliverable; further rounds or scope changes are billed separately by written agreement. A deliverable is deemed accepted if the Client does not give written notice of specific deficiencies within ten (10) days of delivery.</p>` +
      `<h2>5. Client responsibilities</h2>` +
      `<p>Client will supply the materials, access, approvals, and feedback the work requires within five (5) business days of each request. Client warrants it has the rights to all materials it supplies.</p>` +
      `<h2>6. Confidentiality &amp; ownership</h2>` +
      `<p><strong>(a)</strong> Both parties keep confidential information shared during the work strictly confidential, during and after the engagement.</p>` +
      `<p><strong>(b)</strong> On full payment, the deliverables belong to the Client. Provider retains its pre-existing tools and techniques and may show the completed work in a portfolio unless the Client withdraws that permission in writing.</p>` +
      `<h2>7. Termination</h2>` +
      `<p>Either party may terminate with ${f("terminationNoticeDays", "number")} days' written notice; work completed to date is payable, and Provider shall hand over paid-for work in progress. Either party may terminate immediately for a material breach not cured within ten (10) days of written notice.</p>` +
      `<h2>8. Liability</h2>` +
      `<p>Neither party is liable for indirect or consequential damages; each party's total liability is capped at the fees paid or payable under this SOW, except for breaches of confidentiality or indemnifiable third-party claims arising from a party's own negligence.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "worship-set",
    name: "Worship / Music Ministry",
    category: "Ministry",
    description:
      "A worship leader or band serving an event: sets, sound, rehearsal, honorarium.",
    fields: [
      "hostName", "artistName", "effectiveDate", "eventName", "eventDate",
      "eventLocation", "setDetails", "teamSize", "soundTerms", "backlineTerms",
      "rehearsalTerms", "honorarium", "depositAmount", "travelTerms",
      "merchTerms", "cancellationDays", "governingLaw",
    ],
    content:
      `<h1>Worship Ministry Agreement</h1>` +
      `<p>THIS WORSHIP MINISTRY AGREEMENT (the "Agreement"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("hostName", "Host church / event")} (the "Host") and ${f("artistName", "Worship leader / band")} (the "Artist").</p>` +
      `<h2>1. The ministry</h2>` +
      `<p><strong>(a)</strong> Artist will lead worship at ${f("eventName", "Event")} on ${f("eventDate", "Date(s)")} at ${f("eventLocation", "Venue, city")}.</p>` +
      `<p><strong>(b)</strong> Sets: ${f("setDetails", "Number and length of sets; congregational worship vs performance; any specific songs requested")}.</p>` +
      `<p><strong>(c)</strong> The Artist's team comprises ${f("teamSize", "number")} people (musicians, vocalists, and crew). The Host will provide access, parking, and hospitality for the whole team.</p>` +
      `<h2>2. Sound, backline &amp; rehearsal</h2>` +
      `<p><strong>(a)</strong> Sound: ${f("soundTerms", "Who provides PA, monitors (wedges/IEMs), console, and engineer")}.</p>` +
      `<p><strong>(b)</strong> Backline &amp; instruments: ${f("backlineTerms", "Drums, amps, keys — who brings what")}.</p>` +
      `<p><strong>(c)</strong> Rehearsal &amp; soundcheck: ${f("rehearsalTerms", "Venue access time, soundcheck duration, stage plot / input list delivery date")}. The stage plot and input list will be sent at least seven (7) days before the event.</p>` +
      `<h2>3. Honorarium, travel &amp; merchandise</h2>` +
      `<p><strong>(a)</strong> Honorarium: $${f("honorarium", "Amount")}, of which $${f("depositAmount", "0")} is payable on signing to hold the date and the balance on or before the event date.</p>` +
      `<p><strong>(b)</strong> Travel, lodging, meals: ${f("travelTerms", "Who books and who pays; nights covered; per diem")}.</p>` +
      `<p><strong>(c)</strong> Merchandise: ${f("merchTerms", "May the Artist sell merch? Table provided? Any venue fee?")}.</p>` +
      `<h2>4. Recording &amp; licensing</h2>` +
      `<p><strong>(a)</strong> Host may record the sets for its own congregational archive. Livestreaming or commercial release of any recording requires the Artist's separate written consent and appropriate song licensing.</p>` +
      `<p><strong>(b)</strong> Host is responsible for its own public-performance and streaming licenses (e.g. CCLI) for congregational use; Artist warrants it has the right to perform its set list.</p>` +
      `<h2>5. Cancellation &amp; rescheduling</h2>` +
      `<p>Either party may cancel with ${f("cancellationDays", "number")} days' written notice. If the Host cancels inside the window, the deposit is retained and pre-booked, non-refundable costs are reimbursed; if the Artist cancels inside the window other than for force majeure, the deposit is returned. Force-majeure events are first rescheduled in good faith within twelve (12) months.</p>` +
      `<h2>6. Conduct &amp; doctrine</h2>` +
      `<p>Artist will minister in accordance with the doctrinal statement affirmed on their Christian Foundation channel. Host is responsible for venue safety and event insurance. Neither party is liable to the other for indirect or consequential damages arising from the engagement.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "guest-appearance",
    name: "Guest Appearance",
    category: "Ministry",
    description:
      "A guest on a podcast, panel, or broadcast: format, recording, promotion, review rights.",
    fields: [
      "hostName", "guestName", "effectiveDate", "showName", "recordingDate",
      "format", "duration", "topics", "compensation", "publishTerms",
      "promoTerms", "reviewTerms", "governingLaw",
    ],
    content:
      `<h1>Guest Appearance Agreement</h1>` +
      `<p>THIS GUEST APPEARANCE AGREEMENT (the "Agreement"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("hostName", "Host / channel / show")} (the "Host") and ${f("guestName", "Guest's full name")} (the "Guest").</p>` +
      `<h2>1. The appearance</h2>` +
      `<p>Guest will appear on ${f("showName", "Show / podcast / broadcast")} recorded on ${f("recordingDate", "Recording date")} in the following format: ${f("format", "In person / remote; interview / panel / teaching")}, of approximately ${f("duration", "length")}. Topics: ${f("topics", "Agreed topics / passages; anything off-limits")}.</p>` +
      `<h2>2. Compensation</h2>` +
      `<p>${f("compensation", "Honorarium and expenses, or “no compensation — the appearance is voluntary”")}.</p>` +
      `<h2>3. Recording, ownership &amp; publication</h2>` +
      `<p><strong>(a)</strong> Host owns the recording and may publish it as follows: ${f("publishTerms", "Platforms, clips/shorts allowed?, may the Guest re-share or re-publish the episode on their own channels?")}.</p>` +
      `<p><strong>(b)</strong> Host will edit in good faith and will not use the material in a way that misrepresents the Guest's words or beliefs. Clips will preserve the sense of the surrounding context.</p>` +
      `<p><strong>(c)</strong> Review before release: ${f("reviewTerms", "Does the Guest get to review the edit / request corrections before release? Within how many days?")}.</p>` +
      `<h2>4. Promotion &amp; likeness</h2>` +
      `<p>Guest grants Host permission to use their name, likeness, title, and bio to promote the episode. Promotion terms: ${f("promoTerms", "Where the episode will be promoted; any approvals on artwork/thumbnails")}. Neither party will use the other's name to imply endorsement beyond the appearance itself.</p>` +
      `<h2>5. Conduct, cancellation &amp; takedown</h2>` +
      `<p><strong>(a)</strong> Either party may cancel or reschedule the recording with reasonable notice; neither owes the other anything for a cancelled recording except reimbursement of agreed, pre-approved expenses already incurred.</p>` +
      `<p><strong>(b)</strong> If published material later misrepresents the Guest through editing, the Guest may request correction or takedown of the offending portion, and the Host will act in good faith within fourteen (14) days.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  /* ───────────────────────── Creative ───────────────────────── */
  {
    key: "work-for-hire",
    name: "Work-for-Hire",
    category: "Creative",
    description:
      "Commission creative work (design, art, media) with full IP transfer on payment.",
    fields: [
      "clientName", "creatorName", "effectiveDate", "workDescription",
      "specs", "deadline", "fee", "depositPercent", "revisionRounds",
      "killFeePercent", "creditLine", "governingLaw",
    ],
    content:
      `<h1>Work-for-Hire Agreement</h1>` +
      `<p>THIS WORK-FOR-HIRE AGREEMENT (the "Agreement"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("clientName", "Client")} (the "Client") and ${f("creatorName", "Creator")} (the "Creator").</p>` +
      `<h2>1. The commissioned work</h2>` +
      `<p><strong>(a)</strong> Client commissions Creator to produce: ${f("workDescription", "Describe the work — album art, book cover, sermon series graphics, video edit…")} (the "Work").</p>` +
      `<p><strong>(b)</strong> Specifications: ${f("specs", "Dimensions, formats, file types, style references, length")}.</p>` +
      `<p><strong>(c)</strong> Final files are due ${f("deadline", "Deadline")}, with in-progress checkpoints as the parties agree. Dates shift day-for-day where Client feedback or materials are late.</p>` +
      `<h2>2. Fee &amp; payment</h2>` +
      `<p><strong>(a)</strong> The fee is $${f("fee", "Amount")}, of which ${f("depositPercent", "50")}% is payable on signing (non-refundable once work begins) and the balance on delivery of final files. Final files are released on receipt of the balance.</p>` +
      `<p><strong>(b)</strong> The fee includes ${f("revisionRounds", "2")} round(s) of revisions at the agreed checkpoints; further rounds or scope changes are quoted separately in writing before the work proceeds.</p>` +
      `<p><strong>(c)</strong> Kill fee: if Client cancels after work begins, Client pays ${f("killFeePercent", "50")}% of the fee or the value of work completed, whichever is greater, and receives no rights in the unfinished Work.</p>` +
      `<h2>3. Ownership</h2>` +
      `<p><strong>(a)</strong> On full payment, the Work is a work made for hire and belongs entirely to Client; to the extent it does not qualify, Creator hereby assigns all right, title, and interest (including copyright) in the Work to Client.</p>` +
      `<p><strong>(b)</strong> Creator retains pre-existing elements, tools, and techniques, granting Client a perpetual non-exclusive license to those embedded in the Work. Any third-party assets (fonts, stock) are identified and licensed for Client's intended use.</p>` +
      `<p><strong>(c)</strong> Creator may show the Work in a portfolio and credit it as: ${f("creditLine", "Credit line, or “no public credit until release”")}, unless Client withdraws that permission in writing.</p>` +
      `<h2>4. Warranties &amp; approvals</h2>` +
      `<p>Creator warrants the Work is original (aside from identified licensed assets) and does not infringe any third party's rights. Client warrants it has the rights to all materials it supplies (text, logos, photos). A deliverable is deemed accepted if Client does not give written notice of specific deficiencies within ten (10) days.</p>` +
      `<h2>5. Liability</h2>` +
      `<p>Neither party is liable for indirect or consequential damages; each party's total liability is capped at the fee, except for indemnifiable third-party IP claims arising from a party's own breach of its warranties.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "photo-video",
    name: "Photography / Videography",
    category: "Creative",
    description:
      "Shoot coverage for an event or project: schedule, deliverables, usage, raw footage.",
    fields: [
      "clientName", "shooterName", "effectiveDate", "projectName", "shootDate",
      "shootLocation", "coverageHours", "deliverables", "deliveryDays", "fee",
      "depositPercent", "travelTerms", "usageTerms", "rawTerms",
      "cancellationDays", "governingLaw",
    ],
    content:
      `<h1>Photography / Videography Agreement</h1>` +
      `<p>THIS AGREEMENT, effective ${f("effectiveDate", "Effective date")}, is made between ${f("clientName", "Client")} (the "Client") and ${f("shooterName", "Photographer / videographer")} (the "Creator") for coverage of ${f("projectName", "Project / event")}.</p>` +
      `<h2>1. The shoot</h2>` +
      `<p><strong>(a)</strong> Date &amp; location: ${f("shootDate", "Date(s)")} at ${f("shootLocation", "Venue, city")}, for ${f("coverageHours", "number")} hours of coverage. Additional hours are billed at the pro-rated hourly equivalent.</p>` +
      `<p><strong>(b)</strong> Client will secure venue access and any permissions the shoot requires, and will designate a contact with authority on the day.</p>` +
      `<h2>2. Deliverables</h2>` +
      `<p>${f("deliverables", "What is delivered — number of edited photos / video length(s), formats, aspect ratios")}, delivered within ${f("deliveryDays", "number")} days of the shoot via a private download link. Editing style is the Creator's professional judgment consistent with their published portfolio; one round of reasonable revision notes is included on video edits.</p>` +
      `<h2>3. Fees, travel &amp; cancellation</h2>` +
      `<p><strong>(a)</strong> The fee is $${f("fee", "Amount")}, of which ${f("depositPercent", "30")}% is payable on signing to hold the date (non-refundable) and the balance on delivery.</p>` +
      `<p><strong>(b)</strong> Travel: ${f("travelTerms", "Included radius / mileage / travel and lodging for distant shoots")}.</p>` +
      `<p><strong>(c)</strong> Cancellation with at least ${f("cancellationDays", "number")} days' notice forfeits only the deposit; later cancellation owes 50% of the fee. Force-majeure events are first rescheduled in good faith.</p>` +
      `<h2>4. Usage &amp; ownership</h2>` +
      `<p><strong>(a)</strong> Creator owns the copyright in the images/footage and grants Client the following license on full payment: ${f("usageTerms", "Where the Client may use the deliverables — web, social, print, broadcast; exclusive or not; any restrictions")}.</p>` +
      `<p><strong>(b)</strong> Creator may use the deliverables in a portfolio and for self-promotion unless Client withdraws that permission in writing. Neither party will use the material in a way that misrepresents people depicted.</p>` +
      `<p><strong>(c)</strong> Raw files: ${f("rawTerms", "Are RAWs/unedited footage delivered? At what cost? How long are they archived?")}. Creator archives selects for at least ninety (90) days; long-term archival is not guaranteed unless stated.</p>` +
      `<h2>5. Releases &amp; liability</h2>` +
      `<p>Client is responsible for obtaining appearance releases from identifiable participants at Client's event (Creator can supply a form). Creator carries reasonable care of equipment and persons; neither party is liable for indirect or consequential damages, and each party's total liability is capped at the fee. If Creator cannot perform due to emergency, Creator will make reasonable efforts to arrange a comparable substitute or refund all payments, which is the Client's exclusive remedy.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "music-licensing",
    name: "Music Licensing",
    category: "Creative",
    description: "License a song or recording for an event, video, or film.",
    fields: [
      "licensorName", "licenseeName", "effectiveDate", "workTitle", "workWriters",
      "usageScope", "territory", "term", "exclusivity", "licenseFee",
      "creditLine", "governingLaw",
    ],
    content:
      `<h1>Music License Agreement</h1>` +
      `<p>THIS MUSIC LICENSE AGREEMENT (the "Agreement"), effective ${f("effectiveDate", "Effective date")}, is made between ${f("licensorName", "Rights holder")} (the "Licensor") and ${f("licenseeName", "Licensee")} (the "Licensee") regarding ${f("workTitle", "Song / recording title")}, written by ${f("workWriters", "Writer(s)")} (the "Work").</p>` +
      `<h2>1. Grant of license</h2>` +
      `<p><strong>(a)</strong> Licensor grants Licensee a ${f("exclusivity", "non-exclusive / exclusive")} license to use the Work as follows: ${f("usageScope", "Where the Work may be used: event playback, video, film, streaming, sync — and any exclusions")}.</p>` +
      `<p><strong>(b)</strong> Territory: ${f("territory", "Worldwide / specific")}. Term: ${f("term", "Duration of the license")}. Rights not expressly granted are reserved to the Licensor; the license is non-transferable and non-sublicensable except as embedded in the licensed production.</p>` +
      `<h2>2. Fee</h2>` +
      `<p>Licensee pays $${f("licenseFee", "Amount")} on signing. No further royalties are due within the licensed scope. Public-performance royalties collected by performing-rights organizations remain payable by venues/broadcasters in the ordinary way and are not Licensee's obligation under this Agreement.</p>` +
      `<h2>3. Credit</h2>` +
      `<p>Licensee will credit the Work wherever credits customarily appear as: ${f("creditLine", "Credit line, e.g. “Song — Artist, used by permission”")}. Inadvertent failure to credit is not a breach if corrected promptly on notice.</p>` +
      `<h2>4. Warranties &amp; restrictions</h2>` +
      `<p><strong>(a)</strong> Licensor warrants it owns or controls the rights granted and that the Work does not infringe any third party's rights.</p>` +
      `<p><strong>(b)</strong> Licensee will not alter the Work's fundamental character (beyond editing for length/fit), will not use it in content that is unlawful or that disparages the Licensor, and will not register the Work or the production's audio against third-party content-ID systems in a way that claims the Work itself.</p>` +
      `<h2>5. Termination</h2>` +
      `<p>Licensor may terminate for uncured material breach on fourteen (14) days' written notice; on termination Licensee ceases new exploitation of the Work, though copies of the production already lawfully distributed may remain in circulation.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
  {
    key: "appearance-release",
    name: "Appearance Release",
    category: "Creative",
    description:
      "Permission to film someone and use their appearance in a film or video.",
    fields: [
      "producerName", "participantName", "participantAddress", "effectiveDate",
      "projectTitle", "usageScope", "compensation", "governingLaw",
    ],
    content:
      `<h1>Appearance Release</h1>` +
      `<p>THIS APPEARANCE RELEASE (the "Release"), effective ${f("effectiveDate", "Effective date")}, is granted by ${f("participantName", "Participant's full name")} (the "Participant"), of ${fr("participantAddress", "Participant's address")}, to ${f("producerName", "Producer / channel")} (the "Producer") in connection with ${f("projectTitle", "Project title")} (the "Project").</p>` +
      `<h2>1. Grant of rights</h2>` +
      `<p><strong>(a)</strong> Participant grants Producer permission to record, photograph, and use the Participant's appearance, voice, name, likeness, and biographical details in and in connection with the Project.</p>` +
      `<p><strong>(b)</strong> Usage: ${f("usageScope", "Where the material may appear: the film, trailers, promotion, platforms — worldwide, in perpetuity unless narrowed here")}.</p>` +
      `<h2>2. Compensation</h2>` +
      `<p>${f("compensation", "Compensation, or “no compensation — participation is voluntary”")}. Participant acknowledges this as full consideration for the rights granted.</p>` +
      `<h2>3. Editing &amp; integrity</h2>` +
      `<p>Producer may edit, adapt, and combine the material at its discretion, but will not use it in a way that misrepresents the Participant's words or beliefs. Producer is not obligated to use the material or to complete or release the Project.</p>` +
      `<h2>4. Release &amp; ownership</h2>` +
      `<p><strong>(a)</strong> Participant releases Producer, its assigns and licensees, from claims arising from the permitted use of the material — including claims based on likeness, privacy, publicity, or defamation arising from truthful, in-context use — to the extent permitted by law.</p>` +
      `<p><strong>(b)</strong> The recordings are the Producer's property. Participant retains no right of approval over the finished Project except as stated here, and acknowledges that removal of published material may not be fully possible once distributed.</p>` +
      `<h2>5. Authority</h2>` +
      `<p>Participant is at least eighteen (18) years old (or this Release is countersigned by a parent/guardian) and has the full right to grant these permissions without conflicting obligations.</p>` +
      GENERAL_PROVISIONS() +
      SIGNATURES,
  },
];

/* ---------- quote & invoice defaults ----------
 * Structured line-item documents (see lib/billing.ts); these seed the
 * terms/notes fields on new quotes and invoices. */

export const DEFAULT_QUOTE_TERMS =
  "This quote is valid for 30 days from the date above. A signed contract " +
  "or written acceptance confirms the booking; dates are held only once " +
  "any stated deposit is received. Prices cover the scope described — " +
  "additional work is quoted separately.";

export const DEFAULT_INVOICE_TERMS =
  "Payment is due per the terms above. Please reference the invoice " +
  "number with your payment. Questions about this invoice are welcome by " +
  "reply email.";
