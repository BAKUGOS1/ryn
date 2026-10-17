import Link from "next/link";

export function WorkspaceGuide({ organizationId }: { organizationId: string }) {
  return (
    <section
      className="panel settings-panel workspace-guide"
      aria-labelledby="workspace-guide-title"
    >
      <span className="eyebrow">GETTING STARTED</span>
      <h2 id="workspace-guide-title">How Ryn works</h2>
      <p>
        Ryn turns an incoming event or a one-time deadline into a workflow.
        Conditions decide whether to continue, and actions record activity or
        send an email notification to a workspace member.
      </p>
      <Link
        className="button button-secondary"
        href={`/app/${organizationId}/automations`}
      >
        Open Automations
      </Link>

      <details open>
        <summary>Create your first automation</summary>
        <ol>
          <li>
            Open Automations and create a deadline reminder draft. Give it a
            name you will recognize.
          </li>
          <li>
            Choose a future deadline, its UTC offset and IANA timezone (for
            example, Asia/Kolkata). Set Minutes before to 0 to trigger at the
            deadline, or choose how early the reminder should run.
          </li>
          <li>
            Open the workflow studio. Add conditions if needed, then add an
            audit record or a notification. For email, select an active
            workspace member as the recipient.
          </li>
          <li>
            Use Simulate draft to check how the steps match. Simulation does not
            send email, create a real run or use your allowance.
          </li>
          <li>
            Select Save draft, return to the workflow card and publish it.
            Saving alone does not activate your changes.
          </li>
          <li>
            After the scheduled time, refresh Automations and open Execution
            evidence to review the run and each step.
          </li>
        </ol>
        <p>
          Deadline reminders run once. Background processing may take a little
          time after the scheduled moment; delivery is not guaranteed to the
          exact second.
        </p>
      </details>

      <details>
        <summary>Drafts, publishing and pausing</summary>
        <p>
          A draft is your editable version. Publishing creates a fixed version
          that the worker uses for future events. Later draft edits take effect
          only after you publish again.
        </p>
        <p>
          Pause a published workflow to stop new execution. Resume it when you
          are ready. Pausing does not recall an email already sent or
          necessarily cancel work already in progress. Archive workflows you no
          longer need.
        </p>
      </details>

      <details>
        <summary>Understand events and run results</summary>
        <p>
          Recent events shows accepted webhook events and dispatched deadlines.
          Execution evidence shows qualified runs, the published version used
          and the outcome of each step. An event that does not match your
          conditions may not produce a qualified run.
        </p>
        <p>
          A succeeded notification step means the email provider accepted the
          message. Confirm inbox delivery in the provider delivery log; it is
          separate from the workflow result. Check spam or junk folders if the
          message is missing.
        </p>
      </details>

      <details>
        <summary>Send email and test safely</summary>
        <p>
          Start with a short reminder to your own account, publish it and check
          its execution evidence. Pause the test workflow afterwards to keep the
          workspace tidy.
        </p>
        <p>
          When using the Resend test sender, email can only be sent to the
          Resend account email address. Sending to other recipients requires a
          verified sending domain. Choosing a workspace member does not bypass
          this restriction.
        </p>
        <p>
          Email credentials are managed by your deployment administrator. Never
          paste API keys or signing secrets into workflow names, JSON drafts or
          shared messages.
        </p>
      </details>

      <details>
        <summary>Connect an external event with a webhook</summary>
        <p>
          An owner or admin can create a signed webhook workflow when signing is
          configured. Use the endpoint shown on the workflow card and configure
          the sending service to sign requests using the required Ryn webhook
          format.
        </p>
        <p>
          The endpoint alone is not enough: unsigned or invalid requests are
          rejected. Keep the signing secret private. Rotating it requires
          updating the sending service as well.
        </p>
      </details>

      <details>
        <summary>Workspace settings and team access</summary>
        <p>
          Owners and admins can update the workspace name and timezone above.
          Review the timezone and UTC offset on each deadline too; changing
          workspace settings does not rewrite existing workflow deadlines.
        </p>
        <p>
          Use Members to invite teammates and manage their roles. Available
          controls depend on your role. Invitation links must be shared with the
          intended recipient.
        </p>
      </details>

      <details>
        <summary>Troubleshoot a workflow</summary>
        <ul>
          <li>
            <strong>Execution disabled:</strong> ask your administrator to check
            the worker and email configuration. Drafts can still be prepared.
          </li>
          <li>
            <strong>No run yet:</strong> check that the workflow is published
            and active, its deadline is in the future when publishing, and its
            conditions match. Refresh the page after processing.
          </li>
          <li>
            <strong>Email missing:</strong> inspect the notification step and
            provider log, confirm the recipient is allowed by the sender setup,
            then check spam.
          </li>
          <li>
            <strong>Changes did not take effect:</strong> save the draft and
            publish the updated version. If a newer draft conflict appears, load
            the latest saved draft before editing again.
          </li>
          <li>
            <strong>Usage limit reached:</strong> review the workspace limits
            displayed in Automations. Run and notification allowances are shared
            with monitors.
          </li>
        </ul>
        <p>
          Website monitoring has separate setup and availability controls.
          Working automations do not automatically enable website monitoring.
        </p>
      </details>
    </section>
  );
}
