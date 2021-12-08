const Apify = require("apify");
const md5 = require("md5");
const {ApifyClient} = require('apify-client');
const apifyClient = new ApifyClient({token: 's4n6asiKyq6X5wtXLhvTdfC5m'});

Apify.main(async () => {
  const { url, spreadsheetId, driveFolderName } = await Apify.getInput();
  const keyStore = await Apify.openKeyValueStore("images");
  const keyName = md5(url);
  console.log("Keyname", keyName);
  const run = await Apify.call("apify/screenshot-url", {
    url,
    waitUntil: "domcontentloaded",
    delay: 500,
    viewportWidth: 1920,
      headless: false
  });
  console.log(run.defaultKeyValueStoreId)

  const fullScreenshot = await apifyClient.keyValueStore(run.defaultKeyValueStoreId).getRecord('OUTPUT').then(res=>res.value);
  await keyStore.setValue(`${keyName}-fullpage`, fullScreenshot, {
    contentType: "image/png",
  });

  const browser = await Apify.launchPuppeteer({
    launchOptions: {
      args: ["--window-size=1920,1080"],
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
    },
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 3600000 });

  const screenshotBuffer = await page.screenshot();
  await keyStore.setValue(`${keyName}-homepage`, screenshotBuffer, {
    contentType: "image/png",
  });

  let rawData = {
    Website: url,
    Homepage: "",
    Fullpage: "",
  };

  const run1 = await Promise.all([
    Apify.call("yir/google-drive", {
      operations: [
        {
          type: "upload",
          source: {
            type: "key-value-store",
            id: "images",
            forceCloud: true,
            files: [
              {
                key: `${keyName}-homepage`,
                name: `${keyName}-homepage`,
                options: {
                  media: {
                    mimeType: "image/png",
                  },
                },
              },
            ],
          },
          destination: {
            parentFolderName: "Screenshots",
          },
        },
      ],
    }),
    Apify.call("yir/google-drive", {
      operations: [
        {
          type: "upload",
          source: {
            type: "key-value-store",
            id: "TfjJt4CWeThM3I1Ul",
            forceCloud: true,
            files: [
              {
                key: `${keyName}-fullpage`,
                name: `${keyName}-fullpage`,
                options: {
                  media: {
                    mimeType: "image/png",
                  },
                },
              },
            ],
          },
          destination: {
            parentFolderName: driveFolderName,
          },
        },
      ],
    }),
  ]);
  const uploadList1 = await Apify.apifyClient.keyValueStore(run1[0].defaultKeyValueStoreId)
    .getRecord("UPLOAD")
    .then((res) => res.value);
  const uploadList2 = await Apify.apifyClient.keyValueStore(run1[1].defaultKeyValueStoreId)
    .getRecord("UPLOAD")
    .then((res) => res.value);

  console.log(uploadList1, uploadList2);
  rawData["Fullpage"] = uploadList2[0].data.webViewLink;
  rawData["Homepage"] = uploadList1[0].data.webViewLink;
  console.log(rawData);
  const payload = {
    mode: "append",
    spreadsheetId: spreadsheetId,
    publicSpreadsheet: false,
    rawData: [rawData],
    limit: 1,
    deduplicateByField: "Website",
    keepSheetColumnOrder: true,
    createBackup: false,
  };
  const run2 = await Apify.call("lukaskrivka/google-sheets", payload);
});
