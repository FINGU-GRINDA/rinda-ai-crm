import { customerRepository, prospectRepository, icpRepository, settingsRepository } from '../database/repositories/index.js';
import { runTransaction } from '../database/db.js';
import { logger } from '../utils/logger.js';

class MigrationController {
  /**
   * Migrate data from localStorage format to database
   * POST /api/migrate/localstorage
   */
  async migrateFromLocalStorage(req, res, next) {
    try {
      const { customers, prospects, icpProfiles, settings } = req.body;

      const results = {
        customers: { imported: 0, skipped: 0, errors: [] },
        prospects: { imported: 0, skipped: 0, errors: [] },
        icpProfiles: { imported: 0, skipped: 0, errors: [] },
        settings: { imported: 0 }
      };

      // Migrate customers
      if (customers && Array.isArray(customers)) {
        for (const customer of customers) {
          try {
            // Check if customer already exists
            const existing = customerRepository.findById(customer.id);
            if (existing) {
              results.customers.skipped++;
              continue;
            }

            // Create customer
            const created = customerRepository.create({
              id: customer.id,
              name: customer.name,
              website: customer.website,
              industry: customer.industry,
              notes: customer.notes,
              status: customer.status || 'new'
            });

            // Migrate enriched data if exists
            if (customer.enrichedData) {
              customerRepository.saveEnrichment(created.id, customer.enrichedData);
            }

            // Migrate proposals if exist
            if (customer.proposals && Array.isArray(customer.proposals)) {
              for (const proposal of customer.proposals) {
                customerRepository.saveProposal(created.id, {
                  id: proposal.id,
                  title: proposal.title || 'Untitled',
                  content: proposal.content,
                  imageUrl: proposal.imageUrl
                });
              }
            }

            // Migrate follow-up history if exists
            if (customer.followUpHistory && Array.isArray(customer.followUpHistory)) {
              for (const followUp of customer.followUpHistory) {
                customerRepository.saveFollowUp(created.id, {
                  id: followUp.id,
                  type: followUp.type,
                  content: followUp.content,
                  status: followUp.status
                });
              }
            }

            results.customers.imported++;
          } catch (error) {
            results.customers.errors.push({
              customer: customer.name,
              error: error.message
            });
          }
        }
      }

      // Migrate prospects
      if (prospects && Array.isArray(prospects)) {
        for (const prospect of prospects) {
          try {
            // Check if prospect already exists
            const existing = prospectRepository.findById(prospect.id);
            if (existing) {
              results.prospects.skipped++;
              continue;
            }

            // Also check by company name
            if (prospectRepository.exists(prospect.companyName)) {
              results.prospects.skipped++;
              continue;
            }

            prospectRepository.create({
              id: prospect.id,
              companyName: prospect.companyName,
              website: prospect.website,
              industry: prospect.industry,
              sourceArticle: prospect.sourceArticle,
              signalStrength: prospect.signalStrength,
              icpMatch: prospect.icpMatch,
              notes: prospect.notes,
              detectedAt: prospect.detectedAt
            });

            results.prospects.imported++;
          } catch (error) {
            results.prospects.errors.push({
              prospect: prospect.companyName,
              error: error.message
            });
          }
        }
      }

      // Migrate ICP profiles
      if (icpProfiles && Array.isArray(icpProfiles)) {
        for (const profile of icpProfiles) {
          try {
            // Check if profile already exists
            const existing = icpRepository.findById(profile.id);
            if (existing) {
              results.icpProfiles.skipped++;
              continue;
            }

            icpRepository.create({
              id: profile.id,
              name: profile.name,
              industries: profile.industries,
              keywords: profile.keywords,
              companySize: profile.companySize,
              targetRegions: profile.targetRegions
            });

            results.icpProfiles.imported++;
          } catch (error) {
            results.icpProfiles.errors.push({
              profile: profile.name,
              error: error.message
            });
          }
        }
      }

      // Migrate settings
      if (settings) {
        if (settings.slack) {
          settingsRepository.updateSlackSettings(settings.slack);
          results.settings.imported++;
        }
        if (settings.email) {
          settingsRepository.updateEmailSettings(settings.email);
          results.settings.imported++;
        }
        if (settings.collection) {
          settingsRepository.updateCollectionSettings(settings.collection);
          results.settings.imported++;
        }
      }

      logger.info('Migration completed', results);

      res.json({
        success: true,
        message: 'Migration completed',
        data: results
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get migration status
   * GET /api/migrate/status
   */
  async getStatus(req, res, next) {
    try {
      const customerCount = customerRepository.findAll({ limit: 1 }).length > 0;
      const prospectCount = prospectRepository.findAll({ limit: 1 }).length > 0;
      const icpCount = icpRepository.findAll().length > 0;

      res.json({
        success: true,
        data: {
          hasData: customerCount || prospectCount || icpCount,
          customers: customerRepository.getCountByStatus(),
          prospects: prospectRepository.getCountBySignal(),
          icpProfiles: icpRepository.findAll().length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export all data for backup
   * GET /api/migrate/export
   */
  async exportData(req, res, next) {
    try {
      const customers = customerRepository.findAll({ limit: 10000 });
      const prospects = prospectRepository.findAll({ limit: 10000 });
      const icpProfiles = icpRepository.findAll();
      const settings = settingsRepository.getAll();

      res.json({
        success: true,
        data: {
          customers,
          prospects,
          icpProfiles,
          settings,
          exportedAt: Date.now()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const migrationController = new MigrationController();
export default migrationController;
