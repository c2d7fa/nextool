import styles from "./gtd-steps.module.scss";

export function Step(props: {title: string}) {
  return (
    <div className={styles.step}>
      <h1>{props.title}</h1>
      <p>
        Body text. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
      </p>
    </div>
  );
}

export function GtdSteps() {
  return (
    <div className={styles.container}>
      <Step title="1. Capture" />
      <Step title="2. Clarify" />
      <Step title="3. Organize" />
      <Step title="4. Review" />
      <Step title="5. Act" />
    </div>
  );
}
