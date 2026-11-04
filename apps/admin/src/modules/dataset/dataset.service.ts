import type { Dataset, SeriesPoint } from "@flypig/shared";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { WatchInput } from "../agent/prompts/refresh";
import { SNAPSHOT_ROW_ID, SnapshotEntity } from "./dataset.entity";
import { SEED_DATASET } from "./dataset.seed";

/** 变动由后端观测：智能体交的 push_log 一律不信（spec §6） */
const PUSH_LOG_LIMIT = 20;

function clone(dataset: Dataset): Dataset {
  return JSON.parse(JSON.stringify(dataset)) as Dataset;
}

function observePriceChanges(
  previous: SeriesPoint[],
  next: SeriesPoint[],
): Dataset["watch"]["push_log"] {
  const before = new Map(previous.map((point) => [point.date, point.price]));
  const at = new Date().toISOString();
  return next
    .filter((point) => before.has(point.date) && before.get(point.date) !== point.price)
    .map((point) => ({ at, from: before.get(point.date) as number, to: point.price }));
}

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(SnapshotEntity) private readonly repo: Repository<SnapshotEntity>,
  ) {}

  /** 无行即首次启动：写入并返回种子（决策 16） */
  async current(): Promise<Dataset> {
    const row = await this.repo.findOneBy({ id: SNAPSHOT_ROW_ID });
    if (row) return JSON.parse(row.payload) as Dataset;
    const seed = clone(SEED_DATASET);
    await this.save(seed);
    return seed;
  }

  async save(dataset: Dataset): Promise<void> {
    await this.repo.save({ id: SNAPSHOT_ROW_ID, payload: JSON.stringify(dataset) });
  }

  /** 闸门通过后的整份原子替换 */
  async replace(next: Dataset): Promise<Dataset> {
    const previous = await this.current();
    next.watch.push_log = [
      ...previous.watch.push_log,
      ...observePriceChanges(previous.watch.series, next.watch.series),
    ].slice(-PUSH_LOG_LIMIT);
    await this.save(next);
    return next;
  }

  /** 换盯的班次：只写骨架、清空观测，不查价（spec §4） */
  async setWatch(input: WatchInput): Promise<Dataset> {
    const dataset = await this.current();
    dataset.watch = {
      origin: input.origin,
      destination: input.destination,
      date: input.date,
      transport_no: input.transport_no,
      target_price: 0,
      offers: [],
      series: [],
      push_log: [],
    };
    await this.save(dataset);
    return dataset;
  }
}
