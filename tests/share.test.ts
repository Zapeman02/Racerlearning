import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_MODEL, ModelRepository } from '../src/data/models.ts';
import { decodeShareCode, encodeShareCode, extractCode, shareLink } from '../src/data/share.ts';
import { memoryStore } from '../src/data/storage.ts';
import { parseModel, serializeModel } from '../src/data/transfer.ts';

function withoutTimestamp<T extends { createdAt: number }>(model: T) {
  const { createdAt: _createdAt, ...rest } = model;
  return rest;
}

function trainedModel() {
  const repo = new ModelRepository(memoryStore());
  const model = repo.create('Drift Ghost', '#7cff4f', true);
  repo.repaint(model.id, { accent: '#14141a', livery: 'two-tone' });
  const weights = BASE_MODEL.weights!.map((w, i) => +(w + (i % 7) * 0.0123).toFixed(4));
  return repo.recordGeneration(model.id, weights, 1234.6, 42, { ...BASE_MODEL.rewards, drift: 4.5 });
}

test('share code decodes to exactly the same model as a file export', async () => {
  for (const model of [BASE_MODEL, trainedModel()]) {
    const shared = await decodeShareCode(await encodeShareCode(model));
    const exported = parseModel(serializeModel(model));
    assert.deepEqual(withoutTimestamp(shared), withoutTimestamp(exported));
    assert.deepEqual(shared.weights, model.weights);
  }
});

test('share code is URL safe and short enough for a link', async () => {
  const code = await encodeShareCode(trainedModel());
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.ok(code.length < 4000, `code is ${code.length} chars`);
});

test('a full share link decodes the same as the bare code', async () => {
  const code = await encodeShareCode(BASE_MODEL);
  const link = shareLink(code, 'https://example.com/Racerlearning/#old');
  assert.equal(link, `https://example.com/Racerlearning/#m=${code}`);
  assert.equal(extractCode(link), code);
  assert.equal(extractCode(`  ${code}\n`), code);
  assert.deepEqual(withoutTimestamp(await decodeShareCode(link)), withoutTimestamp(await decodeShareCode(code)));
});

test('broken share codes are rejected', async () => {
  const code = await encodeShareCode(BASE_MODEL);
  await assert.rejects(decodeShareCode(''), /No share code/);
  await assert.rejects(decodeShareCode('not a code!'), /No share code/);
  await assert.rejects(decodeShareCode(code.slice(0, code.length / 2)), /broken or incomplete/);
});
