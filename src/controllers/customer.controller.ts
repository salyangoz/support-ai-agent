import { Request, Response, NextFunction } from 'express';
import * as customerService from '../services/customer.service';
import { toSnakeCase } from '../utils/serializer';
import { parsePaginationQuery } from '../utils/pagination';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { email, name, page } = req.query;
    const pagination = parsePaginationQuery(req.query as Record<string, unknown>);

    const result = await customerService.getCustomers(tenantId, {
      email: email as string | undefined,
      name: name as string | undefined,
      cursor: pagination.cursor,
      limit: pagination.limit,
      page: !pagination.cursor && page ? Number(page) : undefined,
    });

    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}

export async function show(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;
    const customer = await customerService.getCustomerById(tenantId, id);

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.status(200).json(toSnakeCase(customer));
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { email, name, phone, external_id, metadata } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const customer = await customerService.upsertCustomer({
      tenantId,
      email,
      name,
      phone,
      externalId: external_id,
      metadata,
    });

    res.status(201).json(toSnakeCase(customer));
  } catch (err) {
    next(err);
  }
}

export async function updateMetadata(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;
    const { metadata } = req.body;

    if (!metadata) {
      res.status(400).json({ error: 'metadata is required' });
      return;
    }

    const customer = await customerService.updateCustomerMetadata(
      tenantId,
      id,
      metadata,
    );

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.status(200).json(toSnakeCase(customer));
  } catch (err) {
    next(err);
  }
}
