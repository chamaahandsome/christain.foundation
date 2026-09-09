import Link from "next/link";
import { LegalPage, List, Section, Sub, Term } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy",
  description:
    "What Christian Foundation collects, why, how it is used, and the rights you hold over it — including our limited use of Google APIs.",
};

const SUPPORT = "support@thecf.online";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="8 September 2026"
      intro={
        <p>
          Christian Foundation (&ldquo;CF&rdquo;, &ldquo;we&rdquo;) is a home
          for sound teaching, and a place where teachers can be found, booked,
          and paid. Handling people&apos;s information carefully is part of
          keeping faith with them. This policy sets out what we collect, why we
          collect it, who we share it with, and what you can ask us to do about
          it.
        </p>
      }
    >
      <Section n={1} heading="Who this covers">
        <p>
          It covers everyone who uses CF at{" "}
          <Link href="/" className="text-amber-700 underline dark:text-amber-400">
            thecf.online
          </Link>{" "}
          — people who watch and read, creators who publish and take bookings,
          and visitors who send a booking request or sign a document without
          ever making an account. Where a rule applies to only one of those
          groups, we say so.
        </p>
        <p>
          By using CF you agree to the handling of information described here.
          If you disagree with any of it, please don&apos;t use the service —
          and do write to us at {SUPPORT}, because we would rather know.
        </p>
      </Section>

      <Section n={2} heading="Information we collect">
        <List>
          <li>
            <Term>Identity.</Term> Your name, channel handle, profile and banner
            images, biography, and anything else you choose to publish on your
            channel.
          </li>
          <li>
            <Term>Contact.</Term> Email address, and for creators the business
            email and address printed on quotes, invoices, and contracts.
          </li>
          <li>
            <Term>Account and sign-in.</Term> Authentication is handled by
            Clerk. If you sign in with Google, we receive your name, email
            address, and profile picture from Google — never your password.
          </li>
          <li>
            <Term>Booking and business.</Term> Booking requests (name, email,
            organisation, dates and times requested, budget, and your message),
            quotes, invoices, and contracts, together with the line items and
            details you put in them.
          </li>
          <li>
            <Term>Signature evidence.</Term> When a document is signed on CF we
            record the signer&apos;s name and email, the drawn or typed
            signature image, the time of signing, the IP address, and the
            browser user agent. This is what makes a signature stand up later,
            and it is retained with the executed document.
          </li>
          <li>
            <Term>Payment.</Term> Payments run through Stripe and, for
            micro-payments, Trickl. They handle card details directly.{" "}
            <Term>We never see or store your card number.</Term> We keep the
            record of what was paid, when, and to whom.
          </li>
          <li>
            <Term>Doctrinal affirmation (creators only).</Term> Applying to
            publish on CF involves affirming a published doctrinal statement,
            and may involve vouches from existing creators. That record concerns
            religious belief, so we treat it with particular care — see section
            4.
          </li>
          <li>
            <Term>Usage and technical.</Term> Pages visited, what you watch and
            how far through, IP address, browser and device type, and log data.
          </li>
        </List>
        <p>
          CF is not intended for children under 16, and we do not knowingly
          collect their information. If you believe a child has given us
          information, write to {SUPPORT} and we will delete it.
        </p>
      </Section>

      <Section n={3} heading="How we use it">
        <List>
          <li>
            <Term>To run the service.</Term> Create and hold your account, show
            your library and channel, track where you are in a pathway, and
            carry a booking through request, quote, contract, and invoice.
          </li>
          <li>
            <Term>To reach you.</Term> Booking notices, signing links,
            confirmations, receipts, security alerts, and replies to your
            support messages. These are sent by email — CF sends no marketing
            messages and no SMS at all.
          </li>
          <li>
            <Term>To take payment.</Term> Process payments, calculate platform
            fees, and pay creators through their connected accounts.
          </li>
          <li>
            <Term>To keep CF safe.</Term> Detect and prevent fraud, spam, and
            abuse, apply rate limits, and enforce our Terms.
          </li>
          <li>
            <Term>To improve it.</Term> Understand which teaching is helping
            people so we can order and present it better.
          </li>
        </List>
        <p>
          We rely, depending on the case, on your consent, on performing our
          contract with you, on our legitimate interest in operating and
          securing CF, and on our legal obligations.
        </p>
      </Section>

      <Section n={4} heading="Doctrinal affirmation and religious belief">
        <p>
          CF exists to gather teaching that holds to historic Christian
          doctrine, so creators applying to publish affirm a published doctrinal
          statement, and other creators may vouch for them. Under data
          protection law an affirmation of belief is a special category of
          personal data, and we handle it accordingly:
        </p>
        <List>
          <li>
            It is given <Term>voluntarily and explicitly</Term>, by creators
            only, as part of applying to publish. Watching, reading, and booking
            require nothing of the kind.
          </li>
          <li>
            It is used only to review the application, to show a channel&apos;s
            standing, and to handle any later doctrinal review of that channel.
          </li>
          <li>
            It is never sold, never used for advertising, and never shared
            outside CF except where the law requires it.
          </li>
        </List>
        <p>
          Withdrawing that affirmation means withdrawing from publishing on CF.
          Write to {SUPPORT} and we will close the channel and remove the
          record.
        </p>
      </Section>

      <Section n={5} heading="Google API Services — limited use">
        <p>
          CF uses two Google APIs, both narrowly. This section is the full
          account of what we do with the access you grant.
        </p>

        <Sub>Google Calendar (calendar.events)</Sub>
        <p>
          A creator who offers one-to-one sessions may connect their Google
          account so that a confirmed session lands on their calendar. With the{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px] dark:bg-neutral-800">
            https://www.googleapis.com/auth/calendar.events
          </code>{" "}
          scope we do exactly two things:
        </p>
        <List>
          <li>
            <Term>Create</Term> an event on the creator&apos;s primary calendar
            when a session is confirmed — its time, the two attendees, and a
            Google Meet link generated for that session.
          </li>
          <li>
            <Term>Delete</Term> that same event if the session is cancelled.
          </li>
        </List>
        <p>
          We touch only the events CF itself created from a booking. We do not
          read, change, share, or delete any other event on your calendar; we do
          not list your calendars or your existing events; and we do not create
          or delete calendars. We request no broader scope than the one above.
          If Google is not connected, booking still works — the confirmation
          email simply carries an &ldquo;add to calendar&rdquo; link instead.
        </p>

        <Sub>YouTube Data API (youtube.readonly)</Sub>
        <p>
          CF&apos;s library is embedded YouTube video, and a creator must prove
          they own the channel they are claiming. If they choose to prove it by
          signing in with Google, we make a single read-only call asking Google
          which channels that account owns, and compare it with the channel
          being claimed. We read nothing else from the account, and we never
          post, edit, or delete anything on YouTube. A creator who prefers not
          to grant this can verify instead by pasting a one-time token into
          their channel description, which needs no Google access at all.
        </p>

        <Sub>Limited Use</Sub>
        <p>
          CF&apos;s use and transfer of information received from Google APIs
          adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 underline dark:text-amber-400"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. In particular, we do not
          sell Google user data; we do not use it for advertising; we do not
          transfer it except as needed to provide these features, for security
          purposes, or where the law requires; and we do not use it to develop,
          train, or improve generalised or non-personalised AI or machine
          learning models.
        </p>
        <p>
          You can withdraw our access at any time from{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 underline dark:text-amber-400"
          >
            your Google account permissions
          </a>{" "}
          or by disconnecting Google in your CF settings. Doing so stops all
          future calendar events immediately.
        </p>
      </Section>

      <Section n={6} heading="Who we share it with">
        <p>
          <Term>We do not sell your personal information</Term>, and we do not
          share it for advertising. We share it only with:
        </p>
        <List>
          <li>
            <Term>Service providers acting for us:</Term> Clerk
            (authentication), Stripe and Trickl (payments), Amazon Web Services
            (email delivery and file storage), Aiven (database hosting), and
            Vercel (site hosting). Each is bound to protect what we entrust to
            them.
          </li>
          <li>
            <Term>The other party to your booking.</Term> When you send a
            booking request, the creator sees your name, email, organisation,
            and message — that is the point of sending it. When a document is
            signed, every party to it receives the executed copy.
          </li>
          <li>
            <Term>Legal authorities,</Term> where the law, a regulation, or a
            court order requires it, or to protect the rights and safety of
            people using CF.
          </li>
          <li>
            <Term>A successor,</Term> if CF is ever merged with or acquired by
            another organisation — under the same protections you have here.
          </li>
        </List>
        <p>
          Watching an embedded YouTube video also involves YouTube, under
          Google&apos;s own privacy policy. We embed rather than host, so
          playback is a matter between you and YouTube.
        </p>
      </Section>

      <Section n={7} heading="Keeping it safe">
        <List>
          <li>Encryption in transit (TLS) and at rest.</li>
          <li>
            Authentication and access controls on every system that holds
            personal information.
          </li>
          <li>
            Signed, expiring links for document signing, so a signing link
            cannot be reused or guessed.
          </li>
          <li>
            Rate limits on public endpoints, and card details never touching our
            servers.
          </li>
        </List>
        <p>
          No system is perfectly secure. If a breach affects you, we will tell
          you and the relevant regulator as the law requires.
        </p>
      </Section>

      <Section n={8} heading="How long we keep it">
        <p>
          We keep information for as long as it takes to run the service, meet
          legal, tax, and accounting obligations, and settle disputes. Executed
          contracts and their signature evidence are kept for as long as they
          may be needed as proof of the agreement. When a period ends we delete
          or anonymise the data.
        </p>
      </Section>

      <Section n={9} heading="Your rights">
        <p>Depending on where you live, you may ask us to:</p>
        <List>
          <li>
            <Term>Give you a copy</Term> of what we hold about you.
          </li>
          <li>
            <Term>Correct</Term> anything inaccurate or incomplete.
          </li>
          <li>
            <Term>Delete</Term> it, so far as our legal obligations allow.
          </li>
          <li>
            <Term>Restrict</Term> or <Term>object to</Term> how we use it.
          </li>
          <li>
            <Term>Take it with you</Term> in a machine-readable form.
          </li>
          <li>
            <Term>Withdraw consent</Term> where we relied on it, without
            unsettling what was done before.
          </li>
        </List>
        <p>
          Write to {SUPPORT} and we will act within the time the law allows. We
          may need to confirm who you are first. If you think we have handled
          your information badly, you may complain to your data protection
          authority.
        </p>
      </Section>

      <Section n={10} heading="Cookies">
        <p>
          CF sets cookies to keep you signed in and to remember settings such as
          light or dark mode; our providers set cookies needed for security and
          payment. You can refuse cookies in your browser, but signing in will
          not work without them.
        </p>
      </Section>

      <Section n={11} heading="Where your information lives">
        <p>
          CF is hosted in the United States, so your information may be
          processed outside your own country. Where we transfer personal data
          across borders we rely on appropriate safeguards, such as Standard
          Contractual Clauses.
        </p>
      </Section>

      <Section n={12} heading="Changes">
        <p>
          We may update this policy. If a change is material we will say so by
          email or on the site before it takes effect, and the date at the top
          will always show the version you are reading.
        </p>
      </Section>

      <Section n={13} heading="Contact us">
        <p>
          Questions, requests, or concerns:{" "}
          <a
            href={`mailto:${SUPPORT}`}
            className="text-amber-700 underline dark:text-amber-400"
          >
            {SUPPORT}
          </a>
          .
        </p>
        <p>
          Thank you for trusting Christian Foundation with your information. See
          also our{" "}
          <Link
            href="/terms"
            className="text-amber-700 underline dark:text-amber-400"
          >
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
