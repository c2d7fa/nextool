import Head from "next/head";
import Link from "next/link";
import styles from "../styles/index.module.scss";

export default function Index() {
  return (
    <>
      <Head>
        <title>Nextool</title>
      </Head>

      <main className={styles.main}>
        <p>
          See <a href="https://github.com/c2d7fa/nextool">the GitHub repository</a> for now.
        </p>
        <p>
          <Link href="/download">Download</Link>
        </p>
      </main>
    </>
  );
}
