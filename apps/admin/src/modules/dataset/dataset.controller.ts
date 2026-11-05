import type { Dataset, InterruptionFlight } from "@flypig/shared";
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Length, ValidateNested } from "class-validator";
import type { DiscoverInput } from "../agent/prompts/discover";
import { type DaysResult, JobsService } from "../jobs/jobs.service";
import { DatasetService } from "./dataset.service";

class DiscoverDto implements DiscoverInput {
  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  flight_no?: string;
}

class WatchDto {
  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  transport_no: string;

  /** 目标价由前端设定时另写，换班次时先归零 */
  target_price = 0;
}

/** 形状复用 InterruptionFlight：给了就 5 个字段全给，缺一个即 400（spec §6） */
class FlightDto implements InterruptionFlight {
  @IsString()
  @IsNotEmpty()
  transport_no: string;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  dep_time: string;
}

class ReplanDto {
  @IsString()
  @Length(1, 200)
  situation: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FlightDto)
  flight?: FlightDto;
}

class DaysQuery {
  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;
}

/** 快照与三类任务的入口（spec §4）；刷新与重规划返回 202 + jobId */
@Controller()
@ApiTags("dataset")
export class DatasetController {
  constructor(
    private readonly dataset: DatasetService,
    private readonly jobs: JobsService,
  ) {}

  @Get("dataset")
  @ApiOperation({ summary: "当前数据快照（无数据时为种子，标示例）" })
  current(): Promise<Dataset> {
    return this.dataset.current();
  }

  @Post("dataset/refresh")
  @HttpCode(202)
  @ApiOperation({ summary: "示例数据 · 一键更新：起一次刷新任务" })
  refresh(): { jobId: string } {
    return { jobId: this.jobs.refresh().id };
  }

  @Post("discover")
  @HttpCode(202)
  @ApiOperation({ summary: "列班次：起一次 discover 任务" })
  discover(@Body() body: DiscoverDto): { jobId: string } {
    return { jobId: this.jobs.discover(body).id };
  }

  @Post("watch")
  @HttpCode(200)
  @ApiOperation({ summary: "换盯的班次：只写骨架，不查价" })
  watch(@Body() body: WatchDto): Promise<{ watch: Dataset["watch"] }> {
    return this.dataset.setWatch(body).then((dataset) => ({ watch: dataset.watch }));
  }

  @Get("cheapest-days")
  @ApiOperation({ summary: "未来 5 天哪天便宜（同航线缓存 10 分钟）" })
  days(@Query() query: DaysQuery): Promise<DaysResult> {
    return this.jobs.cheapestDays(query.origin, query.destination);
  }

  @Post("replan")
  @HttpCode(202)
  @ApiOperation({ summary: "行程被打断：起一次 replan 任务" })
  replan(@Body() body: ReplanDto): { jobId: string } {
    return { jobId: this.jobs.replan(body.situation, body.flight).id };
  }
}
