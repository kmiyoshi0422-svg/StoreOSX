// PDF抽出処理を実環境で再現し、所要時間と成否を計測する
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { storagePut, storageGetSignedUrl } from "../server/storage.ts";
import { invokeLLM } from "../server/_core/llm.ts";

const t0 = Date.now();
const buf = fs.readFileSync("/tmp/sample_request.pdf");
const { key } = await storagePut(`imports/repro-${Date.now()}.pdf`, buf, "application/pdf");
console.log("uploaded key:", key, `(${Date.now() - t0}ms)`);

const t1 = Date.now();
const publicUrl = await storageGetSignedUrl(key);
console.log("signed url ok", `(${Date.now() - t1}ms)`);

const schema = {
  type: "object",
  properties: {
    requestNumber: { type: "string" },
    brand: { type: "string", enum: ["ほっともっと", "やよい軒", "その他"] },
    storeName: { type: "string" },
    storeCode: { type: "string" },
    requestContent: { type: "string" },
    workType: { type: "string", enum: ["入替", "修理", "納品", "見積り", "新規"] },
    urgency: { type: "string", enum: ["S", "A", "B", "C"] },
  },
  required: ["requestNumber", "storeName"],
  additionalProperties: false,
};

const t2 = Date.now();
try {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "あなたはPDF抽出アシスタントです。JSONのみ返します。" },
      {
        role: "user",
        content: [
          { type: "text", text: "このPDFから案件情報を抽出してJSONで返してください。" },
          { type: "file_url", file_url: { url: publicUrl, mime_type: "application/pdf" } },
        ],
      },
    ],
    outputSchema: { name: "extract", strict: false, schema },
  });
  const ms = Date.now() - t2;
  const raw = response.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c) => c.text ?? "").join("") : "";
  console.log(`LLM responded in ${ms}ms`);
  console.log("finish_reason:", response.choices?.[0]?.finish_reason);
  console.log("usage:", JSON.stringify(response.usage));
  console.log("RAW CONTENT >>>");
  console.log(text);
  console.log("<<< RAW CONTENT");
  try {
    const parsed = JSON.parse(text);
    console.log("PARSE OK:", JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log("PARSE FAILED:", e.message);
  }
} catch (e) {
  console.log(`LLM ERROR after ${Date.now() - t2}ms:`, e.message);
}
console.log("TOTAL:", Date.now() - t0, "ms");
