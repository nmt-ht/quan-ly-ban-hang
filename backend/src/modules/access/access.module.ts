import { Module } from '@nestjs/common';
import { RolesController, RolesService } from './roles.js';
import { UsersController, UsersService } from './users.js';

// Thiết lập › Người dùng and Chức vụ & phân quyền.
@Module({
  controllers: [UsersController, RolesController],
  providers: [UsersService, RolesService],
})
export class AccessModule {}
