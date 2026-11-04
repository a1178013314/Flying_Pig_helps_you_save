import { Column, Entity, PrimaryColumn } from "typeorm";

/** 整份快照存一行（决策 15：形状会变，关系表是负担） */
@Entity("snapshot")
export class SnapshotEntity {
  @PrimaryColumn("integer")
  id!: number;

  @Column("text")
  payload!: string;
}

export const SNAPSHOT_ROW_ID = 1;
