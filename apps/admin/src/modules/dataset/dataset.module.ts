import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SnapshotEntity } from "./dataset.entity";
import { DatasetService } from "./dataset.service";

@Module({
  imports: [TypeOrmModule.forFeature([SnapshotEntity])],
  providers: [DatasetService],
  exports: [DatasetService],
})
export class DatasetModule {}
