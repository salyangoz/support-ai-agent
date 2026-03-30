import { Request, Response, NextFunction } from 'express';
import * as customerService from '../services/customer.service';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const { email, name, page, limit } = req.query;

    const customers = await customerService.getCustomers(tenantId, {
      email: email as string | undefined,
      name: name as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({ data: customers });
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
    const tenantId = Number(req.params.tenantId);
    const id = Number(req.params.id);
    const customer = await customerService.getCustomerById(tenantId, id);

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.status(200).json(customer);
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
    const tenantId = Number(req.params.tenantId);
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

    res.status(201).json(customer);
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
    const tenantId = Number(req.params.tenantId);
    const id = Number(req.params.id);
    const { metadata } = req.body;

    if (!metadata) {
      res.status(400).json({ error: 'metadata is required' });
      return;
    }

    const customer = await customerService.updateCustomerMetadata(tenantId, id, metadata);

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
}
