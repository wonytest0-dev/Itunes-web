const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");

const URL =
  "https://kworb.net/itunes/artist/jimin.html";

function getKSTTime() {
  return new Date().toLocaleString(
    "en-GB",
    {
      timeZone: "Asia/Seoul"
    }
  );
}

async function scrapeJiminITunes() {

  console.log(
    "🚀 Launching browser..."
  );

  const browser =
    await chromium.launch({
      headless: true
    });

  const page =
    await browser.newPage();

  try {

    await page.goto(URL, {
      waitUntil:
        "domcontentloaded",
      timeout: 60000
    });

    console.log(
      "✅ Page loaded"
    );

    // klik Show 24h diffs
    await page.click(
      "text=Show 24h diffs"
    );

    console.log(
      "✅ 24h mode enabled"
    );

    // tunggu update page
    await page.waitForTimeout(
      3000
    );

    // ambil seluruh text page
    const text =
      await page
        .locator("body")
        .innerText();

    const lines = text
      .split("\n")
      .map(x =>
        x.trim()
      )
      .filter(Boolean);

    const entries = [];
    const summaryMap = {};

    let currentTitle =
      null;

    let currentType =
      "single";

    let insideITunes =
      false;

    for (
      const line
      of lines
    ) {

      // skip noise
      if (
        line.includes(
          "All services"
        ) ||
        line.includes(
          "All markets"
        ) ||
        line.includes(
          "Discover more"
        ) ||
        line.includes(
          "Historical chart data"
        ) ||
        line.includes(
          "Music news blog"
        ) ||
        line.includes(
          "Streaming monetization course"
        )
      ) {
        continue;
      }

      // detect album
      if (
        line.startsWith(
          "Album:"
        )
      ) {

        currentTitle =
          line
          .replace(
            "Album:",
            ""
          )
          .trim();

        currentType =
          "album";

        insideITunes =
          false;

        continue;
      }

      // detect song title
      const isTitle =
        !line.includes(":") &&
        !line.startsWith("#") &&
        line.length < 60 &&
        !/^\d/.test(
          line
        );

      if (
        isTitle
      ) {

        currentTitle =
          line;

        currentType =
          "single";

        insideITunes =
          false;

        continue;
      }

      // masuk iTunes section
      if (
        line ===
        "iTunes:"
      ) {

        insideITunes =
          true;

        continue;
      }

      // keluar kalau pindah service
      if (
        line.endsWith(
          ":"
        ) &&
        line !==
        "iTunes:"
      ) {

        insideITunes =
          false;
      }
      
      // scrape iTunes ranks
      if (
        insideITunes &&
        line.startsWith(
          "#"
        )
      ) {

        const matches =
          [
            ...line.matchAll(
              /#(\d+)\s(.+?)\s\((.*?)\)/g
            )
          ];

        for (
          const match
          of matches
        ) {

          const rank =
            Number(
              match[1]
            );

          const country =
            match[2]
            .trim();

          const movement =
            match[3]
            .trim();

          const type =
            currentType;

          const item = {

            title:
              currentTitle,

            country,

            rank,

            movement,

            type,

            isTop1:
              rank === 1
          };

          entries.push(
            item
          );

          // summary
          if (
            !summaryMap[
              currentTitle
            ]
          ) {

            summaryMap[
              currentTitle
            ] = {

              title:
                currentTitle,

              type,

              totalEntries:
                0,

              totalTop1:
                0,

              countriesTop1:
                []
            };
          }

          summaryMap[
            currentTitle
          ]
          .totalEntries++;

          if (
            rank === 1
          ) {

            summaryMap[
              currentTitle
            ]
            .totalTop1++;

            summaryMap[
              currentTitle
            ]
            .countriesTop1
            .push(
              country
            );
          }
        }
      }
    }

    const output = {

      updatedAt:
        getKSTTime() +
        " KST",

      totalEntries:
        entries.length,

      totalTop1:
        entries.filter(
          x =>
            x.rank === 1
        ).length,

      singles:
        entries.filter(
          x =>
            x.type ===
            "single"
        ),

      albums:
        entries.filter(
          x =>
            x.type ===
            "album"
        ),

      summary:
        Object.values(
          summaryMap
        ).sort(
          (
            a,
            b
          ) =>
            b.totalTop1 -
            a.totalTop1
        )
    };
    // buat folder data
    await fs.mkdir(
      "data",
      {
        recursive: true
      }
    );

    // save json
    await fs.writeFile(
      path.join(
        "data",
        "jimin-itunes.json"
      ),
      JSON.stringify(
        output,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      `✅ Done | ${entries.length} entries`
    );

    console.log(
      "📁 Saved to data/jimin-itunes.json"
    );

  } catch (err) {

    console.error(
      "❌ Error:",
      err.message
    );

  } finally {

    await browser.close();

  }
}

scrapeJiminITunes();
