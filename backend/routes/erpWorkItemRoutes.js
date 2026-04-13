const express = require('express');
const router = express.Router();

const ERPWorkItem = require('../models/ERPWorkItem');
const { createWorkItem } = require('../utils/erpWorkflowService');

const ensureAdmin = (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
};

const buildOwnerFilter = (req) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin') {
    return {
      $or: [
        { ownerRole: 'admin' },
        { ownerRole: 'admin', ownerRef: req.user?.username || '' }
      ]
    };
  }

  return {
    ownerRole: role,
    ownerRef: req.user?.referenceId || req.user?.username || ''
  };
};

router.get('/my', async (req, res) => {
  try {
    const { status, priority, limit = 50 } = req.query;
    const query = buildOwnerFilter(req);

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const items = await ERPWorkItem.find(query)
      .sort({ priority: -1, updatedAt: -1 })
      .limit(Math.min(200, Math.max(1, Number(limit) || 50)));

    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const query = buildOwnerFilter(req);

    const [open, inProgress, blocked, closed] = await Promise.all([
      ERPWorkItem.countDocuments({ ...query, status: 'open' }),
      ERPWorkItem.countDocuments({ ...query, status: 'in_progress' }),
      ERPWorkItem.countDocuments({ ...query, status: 'blocked' }),
      ERPWorkItem.countDocuments({ ...query, status: 'closed' })
    ]);

    res.json({
      summary: {
        open,
        inProgress,
        blocked,
        closed,
        active: open + inProgress + blocked
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { module, status, ownerRole, ownerRef, limit = 100 } = req.query;
    const query = {};
    if (module) query.module = module;
    if (status) query.status = status;
    if (ownerRole) query.ownerRole = ownerRole;
    if (ownerRef) query.ownerRef = ownerRef;

    const items = await ERPWorkItem.find(query)
      .sort({ updatedAt: -1 })
      .limit(Math.min(500, Math.max(1, Number(limit) || 100)));

    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const payload = req.body || {};
    if (!payload.module || !payload.type || !payload.title || !payload.ownerRole || !payload.sourceRole) {
      return res.status(400).json({ message: 'module, type, title, ownerRole, and sourceRole are required' });
    }

    const created = await createWorkItem({
      ...payload,
      actor: req.user?.username || req.user?.referenceId || 'admin'
    });

    res.status(201).json({ message: 'Work item created successfully', item: created });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, note = '' } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }

    const item = await ERPWorkItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Work item not found' });
    }

    const role = String(req.user?.role || '').toLowerCase();
    const ownerRef = req.user?.referenceId || req.user?.username || '';
    const isOwner = item.ownerRole === role && String(item.ownerRef || '') === String(ownerRef || '');
    const isAdmin = role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this work item' });
    }

    item.status = status;
    item.timeline.push({
      actor: req.user?.username || req.user?.referenceId || role,
      action: 'status_updated',
      note: note || `Status changed to ${status}`
    });

    await item.save();

    res.json({ message: 'Work item status updated successfully', item });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
