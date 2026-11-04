import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const path = config.get<string>("db.path") ?? "data/flypig.sqlite";
        mkdirSync(dirname(path), { recursive: true });
        return {
          type: "better-sqlite3" as const,
          database: path,
          autoLoadEntities: true,
          // shortcut: 骨架期无实体无 migration，实体结构稳定后切 false + migration 管理
          synchronize: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
