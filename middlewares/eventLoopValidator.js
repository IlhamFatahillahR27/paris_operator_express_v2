module.exports = (req, res, next) => {
    const event = req.query.event;
    const validEvents = ['connect', 'disconnect'];

    if (!event) {
        return res.status(400).json({
            success: false,
            error: 'Parameter "event" is required'
        });
    }

    if (!validEvents.includes(event)) {
        return res.status(400).json({
            success: false,
            error: `Invalid event value. Must be one of: ${validEvents.join(', ')}`
        });
    }

    next();
};

